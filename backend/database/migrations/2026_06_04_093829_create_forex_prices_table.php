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
        Schema::create('forex_prices', function (Blueprint $table) {
            $table->id();
            $table->string('pair');
            $table->decimal('price', 15, 8);
            $table->decimal('change_24h', 8, 4)->nullable();
            $table->string('source')->nullable();
            $table->integer('timestamp');
            $table->timestamps();
            
            // Index for fast retrieval of latest prices and historical charting
            $table->index(['pair', 'timestamp']);
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('forex_prices');
    }
};
