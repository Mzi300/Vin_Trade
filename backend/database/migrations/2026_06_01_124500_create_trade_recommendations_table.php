<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        Schema::create('trade_recommendations', function (Blueprint $table) {
            $table->id();
            $table->string('pair', 7);
            $table->string('direction', 6); // BUY or SELL
            $table->decimal('entry_price', 10, 5);
            $table->decimal('stop_loss', 10, 5);
            $table->decimal('take_profit', 10, 5);
            $table->integer('leverage');
            $table->decimal('risk_percent', 5, 2);
            $table->integer('confidence');
            $table->text('reasoning');
            $table->timestamps();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('trade_recommendations');
    }
};
?>
