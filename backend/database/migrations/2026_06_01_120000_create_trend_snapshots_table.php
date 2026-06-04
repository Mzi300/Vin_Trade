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
        Schema::create('trend_snapshots', function (Blueprint $table) {
            $table->id();
            $table->string('currency_pair', 7);
            $table->integer('macro_base');
            $table->integer('macro_quote');
            $table->string('bias', 10);
            $table->decimal('entry_price', 10, 5);
            $table->decimal('stop_loss', 10, 5);
            $table->decimal('take_profit', 10, 5);
            $table->integer('confidence');
            $table->timestamps();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('trend_snapshots');
    }
};
?>
