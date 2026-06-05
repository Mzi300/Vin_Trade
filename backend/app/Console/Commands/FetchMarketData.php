<?php

namespace App\Console\Commands;

use Illuminate\Console\Command;
use App\Services\ForexDataService;
use App\Models\ForexPrice;
use Illuminate\Support\Facades\Log;

class FetchMarketData extends Command
{
    /**
     * The name and signature of the console command.
     *
     * @var string
     */
    protected $signature = 'market:fetch';

    /**
     * The console command description.
     *
     * @var string
     */
    protected $description = 'Fetch live forex market data and store it in the database';

    /**
     * Execute the console command.
     */
    public function handle(ForexDataService $forexService)
    {
        $this->info('Starting market data fetch...');

        try {
            $quotes = $forexService->getLatestQuotes();

            if (empty($quotes)) {
                $this->warn('No data returned from APIs. Empty state triggered.');
                return;
            }

            foreach ($quotes as $quote) {
                $this->info("Fetching Technical Indicators for {$quote['pair']}...");
                $rsi = $forexService->fetchRSI($quote['pair']);
                sleep(8); // TwelveData free tier rate limit: 8 requests per minute
                $macd = $forexService->fetchMACD($quote['pair']);
                sleep(8);

                ForexPrice::create([
                    'pair'       => $quote['pair'],
                    'price'      => $quote['price'],
                    'change_24h' => $quote['change_24h'] ?? null,
                    'rsi'        => $rsi,
                    'macd'       => $macd,
                    'source'     => $quote['source'],
                    'timestamp'  => $quote['timestamp'],
                ]);
            }

            $this->info('Successfully fetched and stored data for ' . count($quotes) . ' pairs.');

        } catch (\Exception $e) {
            Log::error('FetchMarketData failed: ' . $e->getMessage());
            $this->error('Failed to fetch data: ' . $e->getMessage());
        }
    }
}
