<?php

namespace App\Services;

use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Log;
use Carbon\Carbon;

class ForexDataService
{
    /**
     * HTTP timeout in seconds for each external API call.
     */
    protected int $timeout = 8;

    /**
     * List of currency pairs to fetch when no explicit list is provided.
     */
    protected array $defaultPairs = [
        'EUR/USD',
        'GBP/USD',
        'USD/JPY',
        'AUD/USD',
        'USD/CAD',
        'NZD/USD',
        'EUR/GBP',
        'GBP/JPY',
        'EUR/JPY',
    ];

    /**
     * Retrieve the latest quotes for the given pairs.
     * Tries Twelve Data batch first; if unavailable, falls back to Alpha Vantage.
     * Caches the "twelve_data is down" flag for 5 minutes to avoid repeated timeouts.
     */
    public function getLatestQuotes(array $pairs = []): array
    {
        $pairs = $pairs ?: $this->defaultPairs;

        // If Twelve Data worked recently, try it first (batch call)
        if (!Cache::get('twelve_data_down', false)) {
            $prices = $this->batchFetchFromTwelveData($pairs);
            if (!empty($prices)) {
                // Fill any gaps from Alpha Vantage
                $results = [];
                foreach ($pairs as $pair) {
                    if (isset($prices[$pair])) {
                        $results[] = $prices[$pair];
                    } else {
                        $fallback = $this->fetchFromAlphaVantage($pair);
                        if ($fallback) $results[] = $fallback;
                    }
                }
                return $results;
            }
            // Twelve Data failed — mark it down for 5 minutes
            Cache::put('twelve_data_down', true, now()->addMinutes(5));
        }

        // Go straight to Alpha Vantage
        return $this->batchFetchFromAlphaVantage($pairs);
    }

    // ─── Twelve Data ──────────────────────────────────────────────────

    /**
     * Fetch prices for ALL symbols in a single Twelve Data /price call.
     * Returns array keyed by pair name, or empty array on failure.
     */
    protected function batchFetchFromTwelveData(array $pairs): array
    {
        $apiKey = config('services.twelve_data.key');
        if (empty($apiKey)) {
            return [];
        }

        try {
            $response = Http::retry(3, 100)->timeout($this->timeout)
                ->get('https://api.twelvedata.com/price', [
                    'symbol' => implode(',', $pairs),
                    'apikey' => $apiKey,
                ]);
        } catch (\Exception $e) {
            Log::warning('Twelve Data batch price timeout: ' . $e->getMessage());
            return [];
        }

        if ($response->failed()) {
            return [];
        }

        $json = $response->json();
        $results = [];

        // Single symbol → {"price":"..."}, multiple → {"EUR/USD":{"price":"..."},...}
        if (count($pairs) === 1) {
            $pair = $pairs[0];
            if (isset($json['price'])) {
                $results[$pair] = $this->normalizeResult($pair, (float) $json['price'], 'twelve_data');
            }
        } else {
            foreach ($pairs as $pair) {
                if (isset($json[$pair]['price'])) {
                    $results[$pair] = $this->normalizeResult($pair, (float) $json[$pair]['price'], 'twelve_data');
                }
            }
        }

        return $results;
    }

    // ─── Alpha Vantage ────────────────────────────────────────────────

    /**
     * Fetch all pairs from Alpha Vantage one-by-one using the
     * real-time CURRENCY_EXCHANGE_RATE endpoint.
     */
    protected function batchFetchFromAlphaVantage(array $pairs): array
    {
        $results = [];
        foreach ($pairs as $pair) {
            $data = $this->fetchFromAlphaVantage($pair);
            if ($data !== null) {
                $results[] = $data;
            }
        }
        return $results;
    }

    /**
     * Fetch a single forex pair from Alpha Vantage.
     */
    protected function fetchFromAlphaVantage(string $pair): ?array
    {
        $apiKey = config('services.alpha_vantage.key');
        if (empty($apiKey)) {
            return null;
        }

        $from = substr($pair, 0, 3);
        $to   = substr($pair, 4, 3);

        try {
            $response = Http::retry(3, 100)->timeout($this->timeout)
                ->get('https://www.alphavantage.co/query', [
                    'function'      => 'CURRENCY_EXCHANGE_RATE',
                    'from_currency' => $from,
                    'to_currency'   => $to,
                    'apikey'        => $apiKey,
                ]);
        } catch (\Exception $e) {
            Log::warning("Alpha Vantage request failed for {$pair}: " . $e->getMessage());
            return null;
        }

        if ($response->failed()) {
            return null;
        }

        $rate = $response->json('Realtime Currency Exchange Rate');
        if (!$rate || !isset($rate['5. Exchange Rate'])) {
            return null;
        }

        $price = (float) $rate['5. Exchange Rate'];
        $timestamp = isset($rate['6. Last Refreshed'])
            ? Carbon::parse($rate['6. Last Refreshed'])->timestamp
            : Carbon::now()->timestamp;

        return $this->normalizeResult($pair, $price, 'alpha_vantage', $timestamp);
    }

    // ─── Helpers ──────────────────────────────────────────────────────

    protected function normalizeResult(string $pair, float $price, string $source, ?int $timestamp = null): array
    {
        return [
            'pair'       => $pair,
            'price'      => $price,
            'change_24h' => null,
            'timestamp'  => $timestamp ?? Carbon::now()->timestamp,
            'source'     => $source,
        ];
    }
}
