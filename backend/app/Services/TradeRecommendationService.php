<?php

namespace App\Services;

class TradeRecommendationService
{
    /**
     * List of supported currency pairs.
     */
    protected array $pairs = [
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
     * Generate a mock recommendation for a given pair.
     * In a real implementation this would call external macro data APIs.
     */
    public function generateRecommendation(string $pair): array
    {
        // Simple deterministic mock scores based on pair hash
        $seed = crc32($pair);
        $strengthScore = ($seed % 100) + 1; // 1-100
        $bias = $strengthScore > 60 ? 'BUY' : ($strengthScore < 40 ? 'SELL' : 'NEUTRAL');
        $confidence = min(95, max(50, $strengthScore));
        // Mock price levels (random but deterministic)
        $basePrice = 1.0 + ($seed % 100) / 1000; // e.g., 1.0123
        $entry = number_format($basePrice, 4);
        $stopLoss = number_format($basePrice - 0.0015, 4);
        $takeProfit = number_format($basePrice + 0.0030, 4);
        $leverage = 10; // conservative default
        $riskPercent = 1.5;
        $reasoning = "Based on macro‑economic indicators (GDP, employment, interest‑rate outlook) the $pair shows a $bias bias with a confidence of $confidence%.";

        return [
            'pair' => $pair,
            'macro_strength_score' => $strengthScore,
            'bias' => $bias,
            'confidence' => $confidence,
            'entry' => $entry,
            'stop_loss' => $stopLoss,
            'take_profit' => $takeProfit,
            'leverage' => $leverage,
            'risk_percent' => $riskPercent,
            'reasoning' => $reasoning,
        ];
    }

    /**
     * Generate recommendations for all supported pairs.
     */
    public function generateAll(string $timeframe = 'daily'): array
    {
        $results = [];
        foreach ($this->pairs as $pair) {
            // In a real implementation, timeframe would affect macro data;
            // here we just attach it to the result for future use.
            $rec = $this->generateRecommendation($pair);
            $rec['timeframe'] = $timeframe;
            $results[] = $rec;
        }
        return $results;
    }

    /**
     * Build the markdown string expected by the frontend.
     */
    public function buildMarkdown(array $recommendations, string $timeframe = 'daily'): string
    {
        $md = '';
        foreach ($recommendations as $rec) {
            // Filter by timeframe if needed (currently all recommendations carry the same mock data)
            if ($rec['timeframe'] !== $timeframe) {
                continue;
            }
            $md .= "## Pair: {$rec['pair']}\n\n";
            $md .= "## Timeframe: {$rec['timeframe']}\n\n";
            $md .= "## Macro Strength Score: {$rec['macro_strength_score']}\n\n";
            $md .= "## Market Bias: {$rec['bias']}\n\n";
            $md .= "## Trade Plan:\n";
            $md .= "- Entry Zone: {$rec['entry']}\n";
            $md .= "- Stop Loss: {$rec['stop_loss']}\n";
            $md .= "- Take Profit: {$rec['take_profit']}\n";
            $md .= "- Recommended Leverage: {$rec['leverage']}x\n";
            $md .= "- Risk Percent per Trade: {$rec['risk_percent']}%\n\n";
            $md .= "## Confidence Score: {$rec['confidence']}%\n\n";
            $md .= "## Reasoning:\n{$rec['reasoning']}\n\n---\n\n";
        }
        return trim($md);
    }
}
?>
