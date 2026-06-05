<?php

namespace App\Http\Controllers;

use App\Http\Controllers\Controller;
use Illuminate\Http\Request;

class TradeController extends Controller
{
    public function store(Request $request)
    {
        $validated = $request->validate([
            'currency_pair' => 'required|string|max:7',
            'bias' => 'required|in:BUY,SELL',
            'entry_price' => 'required|numeric',
            'stop_loss' => 'required|numeric',
            'take_profit' => 'required|numeric',
            'risk_percentage' => 'required|numeric|min:0.1|max:100',
        ]);

        $validated['status'] = 'OPEN';

        $trade = \App\Models\Trade::create($validated);

        return response()->json(['message' => 'Trade saved to portfolio successfully!', 'trade' => $trade]);
    }
