<?php
declare(strict_types=1);

/*
 * Replace these values with your AWS RDS MySQL details.
 * Do not use your AWS account password here. Use the RDS database user/password.
 */
const DB_HOST = 'concert-db.cke7iknfoxqm.us-east-1.rds.amazonaws.com';
const DB_NAME = 'concert_ticketing';
const DB_USER = 'admin';
const DB_PASS = 'admin123';

const ADMIN_USERNAME = 'admin';
const ADMIN_PASSWORD = 'admin123';

function app_db_config(): array
{
    return [
        'host' => getenv('DB_HOST') ?: DB_HOST,
        'name' => getenv('DB_NAME') ?: DB_NAME,
        'user' => getenv('DB_USER') ?: DB_USER,
        'pass' => getenv('DB_PASS') ?: DB_PASS,
    ];
}

function app_default_events(): array
{
    return [
        [
            'id' => 'weeknd-kuala-lumpur-2026-11-04',
            'name' => 'The Weeknd',
            'date' => '2026-11-04',
            'time' => '20:30',
            'venue' => 'Bukit Jalil National Stadium',
            'city' => 'Kuala Lumpur, Malaysia',
            'price' => 149.00,
        ],
        [
            'id' => 'weeknd-kuala-lumpur-2026-11-05',
            'name' => 'The Weeknd',
            'date' => '2026-11-05',
            'time' => '20:30',
            'venue' => 'Bukit Jalil National Stadium',
            'city' => 'Kuala Lumpur, Malaysia',
            'price' => 138.00,
        ],
        [
            'id' => 'weeknd-singapore-2026-10-02',
            'name' => 'The Weeknd',
            'date' => '2026-10-02',
            'time' => '20:00',
            'venue' => 'Singapore National Stadium',
            'city' => 'Singapore, Singapore',
            'price' => 191.00,
        ],
        [
            'id' => 'weeknd-bangkok-2026-10-12',
            'name' => 'The Weeknd',
            'date' => '2026-10-12',
            'time' => '20:00',
            'venue' => 'Rajamangala National Stadium',
            'city' => 'Bangkok, Thailand',
            'price' => 126.00,
        ],
    ];
}
