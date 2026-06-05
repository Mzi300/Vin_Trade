<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;
use App\Models\Trade;
use Carbon\Carbon;

class TradeSeeder extends Seeder
{
    /**
     * Run the database seeds.
     */
    public function run(): void
    {
        // Clear existing trades to start fresh
        Trade::truncate();

        $trades = [
            [
                'currency_pair' => 'EUR/USD',
                'bias' => 'BUY',
                'entry_price' => 1.0850,
                'stop_loss' => 1.0800,
                'take_profit' => 1.0950,
                'risk_percentage' => 1.5,
                'status' => 'OPEN',
                'created_at' => Carbon::now()->subDays(1),
            ],
            [
                'currency_pair' => 'GBP/USD',
                'bias' => 'SELL',
                'entry_price' => 1.2500,
                'stop_loss' => 1.2550,
                'take_profit' => 1.2400,
                'risk_percentage' => 2.0,
                'status' => 'CLOSED',
                'created_at' => Carbon::now()->subDays(3),
            ],
            [
                'currency_pair' => 'USD/JPY',
                'bias' => 'BUY',
                'entry_price' => 150.20,
                'stop_loss' => 149.50,
                'take_profit' => 151.50,
                'risk_percentage' => 1.0,
                'status' => 'CLOSED',
                'created_at' => Carbon::now()->subDays(5),
            ],
            [
                'currency_pair' => 'AUD/USD',
                'bias' => 'SELL',
                'entry_price' => 0.6500,
                'stop_loss' => 0.6550,
                'take_profit' => 0.6400,
                'risk_percentage' => 1.2,
                'status' => 'OPEN',
                'created_at' => Carbon::now()->subHours(5),
            ],
            [
                'currency_pair' => 'USD/CAD',
                'bias' => 'BUY',
                'entry_price' => 1.3500,
                'stop_loss' => 1.3450,
                'take_profit' => 1.3600,
                'risk_percentage' => 1.5,
                'status' => 'CLOSED',
                'created_at' => Carbon::now()->subWeeks(1),
            ],
        ];

        foreach ($trades as $trade) {
            Trade::create($trade);
        }
    }
}
