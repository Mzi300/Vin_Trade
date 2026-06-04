<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class ForexPrice extends Model
{
    use HasFactory;

    protected $fillable = [
        'pair',
        'price',
        'change_24h',
        'source',
        'timestamp',
    ];
}
