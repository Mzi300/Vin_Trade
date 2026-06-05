<?php

use Illuminate\Support\Facades\Route;
use App\Http\Controllers\AnalysisController;
use App\Http\Controllers\TradeRecommendationController;
use App\Http\Middleware\AdminAuthMiddleware;

Route::middleware('api')->group(function () {
    Route::middleware([AdminAuthMiddleware::class])->group(function () {
        Route::get('/forex', [App\Http\Controllers\ForexDataController::class, 'index']);
        Route::post('/analysis', [AnalysisController::class, 'analyze']);
        Route::get('/trending', [TradeRecommendationController::class, 'index']);
        Route::get('/portfolio', [\App\Http\Controllers\PortfolioController::class, 'index']);
        Route::post('/trade-review', [\App\Http\Controllers\TradeReviewController::class, 'review']);
        Route::post('/trades', [\App\Http\Controllers\TradeController::class, 'store']);
    });
});
