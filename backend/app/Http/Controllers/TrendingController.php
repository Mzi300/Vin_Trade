<?php

namespace App\Http\Controllers;

use App\Services\AnalyticsEngine;
use Illuminate\Http\JsonResponse;

class TrendingController extends Controller
{
    protected AnalyticsEngine $analytics;

    public function __construct(AnalyticsEngine $analytics)
    {
        $this->analytics = $analytics;
    }

    /**
     * Return formatted markdown of trending pairs using real data.
     */
    public function index(): JsonResponse
    {
        $trends = $this->analytics->getTrendingPairs();

        if ($trends->isEmpty()) {
            return response()->json([
                'markdown' => "## Market Trends\n\nNo market data available to calculate trends."
            ]);
        }

        $markdown = "## Top Trending Pairs (Real-Time)\n\n";
        
        foreach ($trends->take(5) as $trend) {
            $icon = $trend['direction'] === 'BULLISH' ? '🟢' : ($trend['direction'] === 'BEARISH' ? '🔴' : '⚪');
            $sign = $trend['percentage_change'] > 0 ? '+' : '';
            
            $markdown .= sprintf(
                "- **%s**: %s %s%s%% (Price: %s)\n",
                $trend['pair'],
                $icon,
                $sign,
                number_format($trend['percentage_change'], 2),
                number_format($trend['price'], 4)
            );
        }

        return response()->json([
            'markdown' => $markdown
        ]);
    }
}
