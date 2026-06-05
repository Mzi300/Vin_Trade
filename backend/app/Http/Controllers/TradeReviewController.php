<?php

namespace App\Http\Controllers;

use App\Models\ForexPrice;
use Illuminate\Http\Request;

class TradeReviewController extends Controller
{
    /**
     * Review the submitted trade mathematically and contextually.
     */
    public function review(Request $request)
    {
        $validated = $request->validate([
            'pair' => 'required|string|max:7',
            'bias' => 'required|in:BUY,SELL',
            'entry_price' => 'required|numeric',
            'stop_loss' => 'required|numeric',
            'take_profit' => 'required|numeric',
            'risk_percentage' => 'required|numeric|min:0.1|max:100',
        ]);

        $pair = $validated['pair'];
        $bias = $validated['bias'];
        $entry = (float) $validated['entry_price'];
        $sl = (float) $validated['stop_loss'];
        $tp = (float) $validated['take_profit'];

        // 1. Calculate Risk/Reward Ratio
        $riskDistance = abs($entry - $sl);
        $rewardDistance = abs($tp - $entry);
        
        if ($riskDistance == 0) {
            return response()->json(['error' => 'Stop loss cannot be identical to entry.'], 400);
        }

        $rrRatio = $rewardDistance / $riskDistance;

        // 2. Trend Alignment (Check live price momentum)
        $latestPriceRecord = ForexPrice::where('pair', $pair)
            ->orderBy('timestamp', 'desc')
            ->first();

        $change24h = $latestPriceRecord ? (float) $latestPriceRecord->change_24h : 0;
        
        $trend = 'NEUTRAL';
        if ($change24h > 0.1) $trend = 'BUY';
        if ($change24h < -0.1) $trend = 'SELL';

        $isAligned = ($bias === $trend) || ($trend === 'NEUTRAL');

        // 3. Generate Safety Score & Warnings
        $score = 100;
        $warnings = [];

        if ($rrRatio < 1.0) {
            $score -= 40;
            $warnings[] = "Risk/Reward is extremely poor (".number_format($rrRatio, 2).":1). You are risking more than you stand to gain.";
        } elseif ($rrRatio < 1.5) {
            $score -= 10;
            $warnings[] = "Risk/Reward is below optimal (1.5:1). Consider tightening your stop loss or extending your target.";
        }

        if (!$isAligned) {
            $score -= 30;
            $warnings[] = "You are fighting the macro 24h trend. The market is currently heavily biased to $trend, but you are placing a $bias order.";
        }

        if ($validated['risk_percentage'] > 2.0) {
            $score -= 20;
            $warnings[] = "Position sizing risk is too high ({$validated['risk_percentage']}%). Professional traders rarely risk more than 1-2% per trade.";
        }

        if ($score < 0) $score = 0;

        return response()->json([
            'rr_ratio' => number_format($rrRatio, 2),
            'trend_alignment' => $isAligned ? 'Aligned' : 'Against Trend',
            'safety_score' => $score,
            'warnings' => $warnings,
            'live_trend' => $trend,
        ]);
    }
}
