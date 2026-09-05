<?php
declare(strict_types=1);

require_once __DIR__ . '/config.php';

function app_start_session(): void
{
    if (session_status() === PHP_SESSION_ACTIVE) {
        return;
    }

    session_set_cookie_params([
        'lifetime' => 0,
        'path' => '/',
        'httponly' => true,
        'samesite' => 'Lax',
        'secure' => !empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off',
    ]);
    session_start();
}

function app_json(array $payload, int $status = 200): never
{
    http_response_code($status);
    header('Content-Type: application/json; charset=utf-8');
    echo json_encode($payload, JSON_UNESCAPED_SLASHES);
    exit;
}

function app_error(string $message, int $status = 400): never
{
    app_json(['ok' => false, 'message' => $message], $status);
}

function app_input(): array
{
    $raw = file_get_contents('php://input') ?: '';
    if ($raw === '') {
        return $_POST;
    }

    $data = json_decode($raw, true);
    return is_array($data) ? $data : $_POST;
}

function app_text(array $data, string $key, int $max = 150): string
{
    $value = trim((string)($data[$key] ?? ''));
    return substr($value, 0, $max);
}

function app_id(string $prefix): string
{
    try {
        return $prefix . '-' . bin2hex(random_bytes(16));
    } catch (Throwable) {
        return $prefix . '-' . time() . '-' . mt_rand(1000, 9999);
    }
}

function app_db_name(string $name): string
{
    if (!preg_match('/^[A-Za-z0-9_]+$/', $name)) {
        throw new RuntimeException('DB_NAME must contain only letters, numbers and underscores.');
    }

    return $name;
}

function db(): PDO
{
    static $pdo = null;
    if ($pdo instanceof PDO) {
        return $pdo;
    }

    $config = app_db_config();
    $dbName = app_db_name($config['name']);
    $dsn = 'mysql:host=' . $config['host'] . ';charset=utf8mb4';
    $pdo = new PDO($dsn, $config['user'], $config['pass'], [
        PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
        PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
        PDO::ATTR_EMULATE_PREPARES => false,
    ]);
    $pdo->exec("CREATE DATABASE IF NOT EXISTS `$dbName` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci");
    $pdo->exec("USE `$dbName`");
    app_migrate($pdo);

    return $pdo;
}

function app_migrate(PDO $pdo): void
{
    static $done = false;
    if ($done) {
        return;
    }

    $pdo->exec("
        CREATE TABLE IF NOT EXISTS profiles (
            id VARCHAR(80) PRIMARY KEY,
            full_name VARCHAR(120) NOT NULL,
            email VARCHAR(180) NOT NULL UNIQUE,
            phone VARCHAR(40) NOT NULL,
            city VARCHAR(120) NOT NULL DEFAULT '',
            created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    ");

    $pdo->exec("
        CREATE TABLE IF NOT EXISTS events (
            id VARCHAR(100) PRIMARY KEY,
            name VARCHAR(140) NOT NULL,
            event_date DATE NOT NULL,
            event_time TIME NOT NULL,
            venue VARCHAR(180) NOT NULL,
            city VARCHAR(160) NOT NULL,
            price DECIMAL(10,2) NOT NULL,
            created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    ");

    $pdo->exec("
        CREATE TABLE IF NOT EXISTS bookings (
            id VARCHAR(80) PRIMARY KEY,
            profile_id VARCHAR(80) NOT NULL,
            concert_id VARCHAR(100) NOT NULL,
            quantity INT NOT NULL,
            created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            UNIQUE KEY unique_profile_event (profile_id, concert_id),
            CONSTRAINT fk_bookings_profile FOREIGN KEY (profile_id) REFERENCES profiles(id) ON DELETE CASCADE,
            CONSTRAINT fk_bookings_event FOREIGN KEY (concert_id) REFERENCES events(id)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    ");

    $count = (int)$pdo->query('SELECT COUNT(*) FROM events')->fetchColumn();
    if ($count === 0) {
        $stmt = $pdo->prepare('
            INSERT INTO events (id, name, event_date, event_time, venue, city, price)
            VALUES (:id, :name, :event_date, :event_time, :venue, :city, :price)
        ');
        foreach (app_default_events() as $event) {
            $stmt->execute([
                ':id' => $event['id'],
                ':name' => $event['name'],
                ':event_date' => $event['date'],
                ':event_time' => $event['time'],
                ':venue' => $event['venue'],
                ':city' => $event['city'],
                ':price' => $event['price'],
            ]);
        }
    }

    $done = true;
}

function app_profile_row(?array $row): ?array
{
    if (!$row) {
        return null;
    }

    return [
        'id' => $row['id'],
        'fullName' => $row['full_name'],
        'email' => $row['email'],
        'phone' => $row['phone'],
        'city' => $row['city'],
    ];
}

function app_event_row(array $row): array
{
    return [
        'id' => $row['id'],
        'name' => $row['name'],
        'date' => $row['event_date'],
        'time' => substr((string)$row['event_time'], 0, 5),
        'venue' => $row['venue'],
        'city' => $row['city'],
        'price' => (float)$row['price'],
    ];
}

function app_booking_row(array $row): array
{
    return [
        'id' => $row['id'],
        'profileId' => $row['profile_id'],
        'concertId' => $row['concert_id'],
        'quantity' => (int)$row['quantity'],
        'createdAt' => $row['created_at'],
    ];
}

function app_profiles(PDO $pdo): array
{
    $rows = $pdo->query('SELECT id, full_name, email, phone, city FROM profiles ORDER BY created_at DESC')->fetchAll();
    return array_map('app_profile_row', $rows);
}

function app_events(PDO $pdo): array
{
    $rows = $pdo->query('SELECT id, name, event_date, event_time, venue, city, price FROM events ORDER BY event_date, event_time')->fetchAll();
    return array_map('app_event_row', $rows);
}

function app_current_profile(PDO $pdo): ?array
{
    $profileId = $_SESSION['profile_id'] ?? '';
    if (!$profileId) {
        return null;
    }

    $stmt = $pdo->prepare('SELECT id, full_name, email, phone, city FROM profiles WHERE id = :id');
    $stmt->execute([':id' => $profileId]);
    $profile = app_profile_row($stmt->fetch() ?: null);
    if (!$profile) {
        unset($_SESSION['profile_id']);
    }

    return $profile;
}

function app_bookings(PDO $pdo, ?string $profileId): array
{
    if (!$profileId) {
        return [];
    }

    $stmt = $pdo->prepare('SELECT id, profile_id, concert_id, quantity, created_at FROM bookings WHERE profile_id = :profile_id ORDER BY created_at DESC');
    $stmt->execute([':profile_id' => $profileId]);
    return array_map('app_booking_row', $stmt->fetchAll());
}
