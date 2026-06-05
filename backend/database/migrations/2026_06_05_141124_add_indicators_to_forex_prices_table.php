<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        Schema::table('forex_prices', function (Blueprint $table) {
            $table->decimal('rsi', 8, 4)->nullable();
            $table->decimal('macd', 15, 8)->nullable();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('forex_prices', function (Blueprint $table) {
            $table->dropColumn(['rsi', 'macd']);
        });
    }
};
