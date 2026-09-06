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

function app_cookie_secure(): bool
{
    $https = !empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off';
    $forwarded = strtolower((string)($_SERVER['HTTP_X_FORWARDED_PROTO'] ?? ''));
    return $https || $forwarded === 'https';
}

function app_admin_cookie_name(): string
{
    return 'soundwave_admin_sid';
}

function app_set_admin_cookie(string $token, int $expires): void
{
    setcookie(app_admin_cookie_name(), $token, [
        'expires' => $expires,
        'path' => '/',
        'httponly' => true,
        'samesite' => 'Lax',
        'secure' => app_cookie_secure(),
    ]);
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
            password_hash VARCHAR(255) NULL,
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
            order_no VARCHAR(30) NOT NULL UNIQUE,
            buyer_name VARCHAR(120) NOT NULL,
            buyer_email VARCHAR(180) NOT NULL,
            quantity INT NOT NULL,
            created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            UNIQUE KEY unique_profile_event (profile_id, concert_id),
            CONSTRAINT fk_bookings_profile FOREIGN KEY (profile_id) REFERENCES profiles(id) ON DELETE CASCADE,
            CONSTRAINT fk_bookings_event FOREIGN KEY (concert_id) REFERENCES events(id)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    ");

    $pdo->exec("
        CREATE TABLE IF NOT EXISTS admin_sessions (
            id VARCHAR(80) PRIMARY KEY,
            token_hash CHAR(64) NOT NULL UNIQUE,
            expires_at DATETIME NOT NULL,
            created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    ");

    app_add_column($pdo, 'profiles', 'password_hash', 'VARCHAR(255) NULL AFTER email');
    app_add_column($pdo, 'bookings', 'order_no', 'VARCHAR(30) NULL AFTER concert_id');
    app_add_column($pdo, 'bookings', 'buyer_name', 'VARCHAR(120) NULL AFTER order_no');
    app_add_column($pdo, 'bookings', 'buyer_email', 'VARCHAR(180) NULL AFTER buyer_name');
    app_backfill_booking_columns($pdo);
    app_make_not_null($pdo, 'bookings', 'order_no', 'VARCHAR(30)');
    app_make_not_null($pdo, 'bookings', 'buyer_name', 'VARCHAR(120)');
    app_make_not_null($pdo, 'bookings', 'buyer_email', 'VARCHAR(180)');
    $pdo->exec('DELETE FROM admin_sessions WHERE expires_at < UTC_TIMESTAMP()');

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

function app_column_exists(PDO $pdo, string $table, string $column): bool
{
    $config = app_db_config();
    $stmt = $pdo->prepare('
        SELECT COUNT(*)
        FROM INFORMATION_SCHEMA.COLUMNS
        WHERE TABLE_SCHEMA = :schema AND TABLE_NAME = :table AND COLUMN_NAME = :column
    ');
    $stmt->execute([':schema' => $config['name'], ':table' => $table, ':column' => $column]);
    return (int)$stmt->fetchColumn() > 0;
}

function app_add_column(PDO $pdo, string $table, string $column, string $definition): void
{
    if (app_column_exists($pdo, $table, $column)) {
        return;
    }

    $pdo->exec("ALTER TABLE `$table` ADD COLUMN `$column` $definition");
}

function app_make_not_null(PDO $pdo, string $table, string $column, string $type): void
{
    $pdo->exec("ALTER TABLE `$table` MODIFY COLUMN `$column` $type NOT NULL");
}

function app_order_no(): string
{
    return 'CT' . date('ymd') . mt_rand(1000, 9999);
}

function app_create_admin_session(PDO $pdo): void
{
    $token = bin2hex(random_bytes(32));
    $expires = time() + 21600;
    $stmt = $pdo->prepare('
        INSERT INTO admin_sessions (id, token_hash, expires_at)
        VALUES (:id, :token_hash, UTC_TIMESTAMP() + INTERVAL 6 HOUR)
    ');
    $stmt->execute([
        ':id' => app_id('admin-session'),
        ':token_hash' => hash('sha256', $token),
    ]);

    $_SESSION['admin_signed_in'] = true;
    app_set_admin_cookie($token, $expires);
}

function app_clear_admin_session(PDO $pdo): void
{
    $token = (string)($_COOKIE[app_admin_cookie_name()] ?? '');
    if ($token !== '') {
        $stmt = $pdo->prepare('DELETE FROM admin_sessions WHERE token_hash = :token_hash');
        $stmt->execute([':token_hash' => hash('sha256', $token)]);
    }

    unset($_SESSION['admin_signed_in']);
    app_set_admin_cookie('', time() - 3600);
}

function app_admin_authorized(PDO $pdo): bool
{
    if (!empty($_SESSION['admin_signed_in'])) {
        return true;
    }

    $token = (string)($_COOKIE[app_admin_cookie_name()] ?? '');
    if ($token === '') {
        return false;
    }

    $stmt = $pdo->prepare('SELECT id FROM admin_sessions WHERE token_hash = :token_hash AND expires_at > UTC_TIMESTAMP() LIMIT 1');
    $stmt->execute([':token_hash' => hash('sha256', $token)]);
    if (!$stmt->fetch()) {
        return false;
    }

    $_SESSION['admin_signed_in'] = true;
    return true;
}

function app_backfill_booking_columns(PDO $pdo): void
{
    $rows = $pdo->query('
        SELECT b.id, b.order_no, b.buyer_name, b.buyer_email, p.full_name, p.email
        FROM bookings b
        JOIN profiles p ON p.id = b.profile_id
        WHERE b.order_no IS NULL OR b.order_no = "" OR b.buyer_name IS NULL OR b.buyer_name = "" OR b.buyer_email IS NULL OR b.buyer_email = ""
    ')->fetchAll();

    $stmt = $pdo->prepare('
        UPDATE bookings
        SET order_no = :order_no, buyer_name = :buyer_name, buyer_email = :buyer_email
        WHERE id = :id
    ');
    foreach ($rows as $row) {
        $stmt->execute([
            ':order_no' => $row['order_no'] ?: app_order_no(),
            ':buyer_name' => $row['buyer_name'] ?: $row['full_name'],
            ':buyer_email' => $row['buyer_email'] ?: $row['email'],
            ':id' => $row['id'],
        ]);
    }
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
        'orderNo' => $row['order_no'],
        'buyerName' => $row['buyer_name'],
        'buyerEmail' => $row['buyer_email'],
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

    $stmt = $pdo->prepare('SELECT id, profile_id, concert_id, order_no, buyer_name, buyer_email, quantity, created_at FROM bookings WHERE profile_id = :profile_id ORDER BY created_at DESC');
    $stmt->execute([':profile_id' => $profileId]);
    return array_map('app_booking_row', $stmt->fetchAll());
}
