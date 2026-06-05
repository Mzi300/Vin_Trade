<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

class AdminAuthMiddleware
{
    /**
     * Handle an incoming request.
     *
     * @param  \Closure(\Illuminate\Http\Request): (\Symfony\Component\HttpFoundation\Response)  $next
     */
    public function handle(Request $request, Closure $next): Response
    {
        // Handle preflight OPTIONS requests for CORS
        if ($request->isMethod('OPTIONS')) {
            return $next($request);
        }

        $providedKey = $request->header('X-Admin-Key');
        $expectedKey = env('ADMIN_PASSWORD');

        if (!$expectedKey) {
            return response()->json(['error' => 'Server Configuration Error: ADMIN_PASSWORD is not set in .env'], 500);
        }

        if (!$providedKey || $providedKey !== $expectedKey) {
            return response()->json(['error' => 'Unauthorized. Invalid Admin Key.'], 401);
        }

        return $next($request);
    }
}
