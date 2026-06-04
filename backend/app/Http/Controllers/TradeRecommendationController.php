<?php

namespace App\Http\Controllers;

use App\Services\TradeRecommendationService;
use Illuminate\Http\Request;

class TradeRecommendationController extends Controller
{
    protected TradeRecommendationService $service;

    public function __construct(TradeRecommendationService $service)
    {
        $this->service = $service;
    }

    /**
     * Return trade recommendations for all supported pairs.
     */
    public function index(Request $request)
    {
        $timeframe = $request->query('tf', 'daily'); // default to daily
        $recommendations = $this->service->generateAll();
        $markdown = $this->service->buildMarkdown($recommendations, $timeframe);
        // optionally store each recommendation in DB (already handled in service if needed)
        return response()->json(['markdown' => $markdown]);
    }
}
?>
