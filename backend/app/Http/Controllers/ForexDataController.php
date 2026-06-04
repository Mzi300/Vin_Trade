<?php

namespace App\Http\Controllers;

use App\Models\ForexPrice;
use Illuminate\Http\Request;
use Illuminate\Http\JsonResponse;

class ForexDataController extends Controller
{
    /**
     * Return latest forex quotes from the database (polled layer).
     * Accept optional query parameter 'pairs' as comma-separated list.
     */
    public function index(Request $request): JsonResponse
    {
        $pairsParam = $request->query('pairs');
        
        try {
            $query = ForexPrice::query()
                ->select('pair', 'price', 'change_24h', 'timestamp', 'source')
                ->whereIn('id', function($q) {
                    $q->selectRaw('MAX(id)')
                      ->from('forex_prices')
                      ->groupBy('pair');
                });

            if ($pairsParam) {
                $pairs = array_map('trim', explode(',', $pairsParam));
                $query->whereIn('pair', $pairs);
            }

            $data = $query->get();

            return response()->json($data);
        } catch (\Exception $e) {
            // If database is down or empty, return empty array as per strictly "NO FAKE DATA" rules.
            return response()->json([]);
        }
    }
}
