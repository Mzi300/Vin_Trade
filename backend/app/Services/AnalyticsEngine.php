<?php

namespace App\Services;

use App\Models\ForexPrice;
use Illuminate\Support\Collection;

class AnalyticsEngine
{
    /**
     * Get the trending pairs based on real historical data.
     */
    public function getTrendingPairs(): Collection
    {
        try {
            // Fetch the latest prices for each pair
            $latestPrices = ForexPrice::query()
                ->select('pair', 'price', 'change_24h')
                ->whereIn('id', function($q) {
                    $q->selectRaw('MAX(id)')
                      ->from('forex_prices')
                      ->groupBy('pair');
                })
                ->get();

            if ($latestPrices->isEmpty()) {
                return collect([]);
            }

            // Calculate trends and volatility
            $analyzed = $latestPrices->map(function ($data) {
                // If API didn't provide change_24h, we could calculate it from older records,
                // but for now we rely on the API or default to 0 if missing.
                $change = $data->change_24h ?? 0;
                
                $direction = 'NEUTRAL';
                if ($change > 0) $direction = 'BULLISH';
                if ($change < 0) $direction = 'BEARISH';
                
                $volatility = abs($change);

                return [
                    'pair' => $data->pair,
                    'price' => $data->price,
                    'percentage_change' => $change,
                    'direction' => $direction,
                    'volatility' => $volatility,
                ];
            });

            // Sort by volatility (highest absolute change first)
            return $analyzed->sortByDesc('volatility')->values();

        } catch (\Exception $e) {
            return collect([]);
        }
    }
}
