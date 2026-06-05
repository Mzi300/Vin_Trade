<?php

namespace App\Http\Controllers;

use App\Models\Trade;
use Illuminate\Http\Request;

class PortfolioController extends Controller
{
    /**
     * Retrieve all trades for the portfolio dashboard.
     */
    public function index()
    {
        // For a single-user system or dummy app, we just pull all trades ordered by newest first.
        $trades = Trade::orderBy('created_at', 'desc')->get();
        return response()->json($trades);
    }
}
