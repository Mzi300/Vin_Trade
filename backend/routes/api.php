<?php

use Illuminate\Support\Facades\Route;
use App\Http\Controllers\AnalysisController;
use App\Http\Controllers\TradeRecommendationController;

Route::middleware('api')->group(function () {
    Route::get('/forex', [App\Http\Controllers\ForexDataController::class, 'index']);
    Route::post('/analysis', [AnalysisController::class, 'analyze']);
    Route::get('/trending', [TradeRecommendationController::class, 'index']);
});
