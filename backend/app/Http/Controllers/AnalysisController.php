<?php

namespace App\Http\Controllers;

use App\Http\Controllers\Controller;
use Illuminate\Http\Request;
use App\Models\AiAnalysis;
use Illuminate\Support\Facades\Http;

class AnalysisController extends Controller
{
    public function analyze(Request $request)
    {
        $validated = $request->validate([
            'pair' => 'required|string|max:7' // e.g. EUR/USD
        ]);

        $pair = strtoupper($validated['pair']);
        $allowedPairs = ['EUR/USD', 'GBP/USD', 'USD/JPY', 'AUD/USD', 'USD/CAD', 'NZD/USD', 'EUR/GBP', 'GBP/JPY', 'EUR/JPY'];
        
        if (!in_array($pair, $allowedPairs)) {
            return response()->json(['error' => 'Unsupported pair. Strict scope rules apply.'], 400);
        }

        $response = Http::withHeaders([
            'X-API-Key' => config('services.ai_provider.key')
        ])->post('https://api.fx-intelligence.ai/v1/analyze', [
            'pair' => $pair
        ]);

        if ($response->failed()) {
            return response()->json(['error' => 'Intelligence service unavailable'], 503);
        }

        $data = $response->json();
        $markdown = $data['markdown'];
        $bias = $data['bias'];
        $confidence = $data['confidence'];

        $analysis = AiAnalysis::create([
            'currency_pair' => $pair,
            'bias' => $bias,
            'confidence' => $confidence,
            'risk_level' => $data['risk_level'] ?? 'LOW',
            'trade_plan_summary' => $data['summary'],
            'raw_markdown' => $markdown,
        ]);

        return response()->json([
            'markdown' => $markdown,
            'metadata' => $analysis
        ]);
    }
}
