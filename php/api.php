<?php
declare(strict_types=1);

require_once __DIR__ . '/db.php';

app_start_session();

function require_profile(PDO $pdo): array
{
    $profile = app_current_profile($pdo);
    if (!$profile) {
        app_error('Sign in before continuing.', 401);
    }

    return $profile;
}

function require_admin(): void
{
    if (empty($_SESSION['admin_signed_in'])) {
        app_error('Admin sign in required.', 401);
    }
}

function app_state(PDO $pdo, ?array $profile = null): array
{
    if (!empty($_SESSION['admin_signed_in'])) {
        $profile = null;
    } else {
        $profile = $profile ?? app_current_profile($pdo);
    }
    return [
        'ok' => true,
        'events' => app_events($pdo),
        'accounts' => [],
        'profile' => $profile,
        'bookings' => app_bookings($pdo, $profile['id'] ?? null),
        'admin' => !empty($_SESSION['admin_signed_in']),
    ];
}

try {
    $pdo = db();
    $action = (string)($_GET['action'] ?? $_POST['action'] ?? 'bootstrap');
    $input = app_input();

    if ($_SERVER['REQUEST_METHOD'] === 'GET' && $action === 'bootstrap') {
        app_json(app_state($pdo));
    }

    if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
        app_error('Use POST for this action.', 405);
    }

    if ($action === 'update_profile') {
        $profile = require_profile($pdo);
        $fullName = app_text($input, 'fullName', 120);
        $email = strtolower(app_text($input, 'email', 180));
        $phone = app_text($input, 'phone', 40);
        $city = app_text($input, 'city', 120);

        if ($fullName === '' || !filter_var($email, FILTER_VALIDATE_EMAIL) || $phone === '') {
            app_error('Enter your name, valid email address and phone number.');
        }

        $exists = $pdo->prepare('SELECT COUNT(*) FROM profiles WHERE email = :email AND id <> :id');
        $exists->execute([':email' => $email, ':id' => $profile['id']]);
        if ((int)$exists->fetchColumn() > 0) {
            app_error('Another account already uses that email.');
        }

        $stmt = $pdo->prepare('
            UPDATE profiles
            SET full_name = :full_name, email = :email, phone = :phone, city = :city
            WHERE id = :id
        ');
        $stmt->execute([
            ':full_name' => $fullName,
            ':email' => $email,
            ':phone' => $phone,
            ':city' => $city,
            ':id' => $profile['id'],
        ]);

        app_json(app_state($pdo));
    }

    if ($action === 'delete_profile') {
        $profile = require_profile($pdo);
        $stmt = $pdo->prepare('DELETE FROM profiles WHERE id = :id');
        $stmt->execute([':id' => $profile['id']]);
        unset($_SESSION['profile_id']);
        app_json(app_state($pdo, null));
    }

    if ($action === 'create_booking') {
        $profile = require_profile($pdo);
        $concertId = app_text($input, 'concertId', 100);
        $quantity = (int)($input['quantity'] ?? 0);
        if ($quantity < 1 || $quantity > 5) {
            app_error('Choose 1 to 5 tickets.');
        }

        $event = $pdo->prepare('SELECT id FROM events WHERE id = :id');
        $event->execute([':id' => $concertId]);
        if (!$event->fetch()) {
            app_error('Event unavailable.', 404);
        }

        $existing = $pdo->prepare('SELECT id, quantity FROM bookings WHERE profile_id = :profile_id AND concert_id = :concert_id');
        $existing->execute([':profile_id' => $profile['id'], ':concert_id' => $concertId]);
        $booking = $existing->fetch();

        if ($booking) {
            $nextQuantity = (int)$booking['quantity'] + $quantity;
            if ($nextQuantity > 5) {
                app_error('You can reserve up to 5 tickets per event.');
            }

            $stmt = $pdo->prepare('UPDATE bookings SET quantity = :quantity WHERE id = :id AND profile_id = :profile_id');
            $stmt->execute([':quantity' => $nextQuantity, ':id' => $booking['id'], ':profile_id' => $profile['id']]);
        } else {
            $stmt = $pdo->prepare('
                INSERT INTO bookings (id, profile_id, concert_id, order_no, buyer_name, buyer_email, quantity)
                VALUES (:id, :profile_id, :concert_id, :order_no, :buyer_name, :buyer_email, :quantity)
            ');
            $stmt->execute([
                ':id' => app_id('booking'),
                ':profile_id' => $profile['id'],
                ':concert_id' => $concertId,
                ':order_no' => app_order_no(),
                ':buyer_name' => $profile['fullName'],
                ':buyer_email' => $profile['email'],
                ':quantity' => $quantity,
            ]);
        }

        app_json(app_state($pdo, $profile));
    }

    if ($action === 'update_booking') {
        $profile = require_profile($pdo);
        $bookingId = app_text($input, 'bookingId', 80);
        $quantity = (int)($input['quantity'] ?? 0);
        if ($quantity < 1 || $quantity > 5) {
            app_error('Choose 1 to 5 tickets.');
        }

        $stmt = $pdo->prepare('UPDATE bookings SET quantity = :quantity WHERE id = :id AND profile_id = :profile_id');
        $stmt->execute([':quantity' => $quantity, ':id' => $bookingId, ':profile_id' => $profile['id']]);
        app_json(app_state($pdo, $profile));
    }

    if ($action === 'change_password') {
        $profile = require_profile($pdo);
        $currentPassword = (string)($input['currentPassword'] ?? '');
        $newPassword = (string)($input['newPassword'] ?? '');
        if (strlen($newPassword) < 6) {
            app_error('Use a password with at least 6 characters.');
        }

        $stmt = $pdo->prepare('SELECT password_hash FROM profiles WHERE id = :id');
        $stmt->execute([':id' => $profile['id']]);
        $row = $stmt->fetch();
        if (!$row || !$row['password_hash'] || !password_verify($currentPassword, $row['password_hash'])) {
            app_error('Current password is incorrect.');
        }

        $update = $pdo->prepare('UPDATE profiles SET password_hash = :password_hash WHERE id = :id');
        $update->execute([':password_hash' => password_hash($newPassword, PASSWORD_DEFAULT), ':id' => $profile['id']]);
        app_json(app_state($pdo, $profile));
    }

    if ($action === 'delete_booking') {
        $profile = require_profile($pdo);
        $bookingId = app_text($input, 'bookingId', 80);
        $stmt = $pdo->prepare('DELETE FROM bookings WHERE id = :id AND profile_id = :profile_id');
        $stmt->execute([':id' => $bookingId, ':profile_id' => $profile['id']]);
        app_json(app_state($pdo, $profile));
    }

    if ($action === 'save_event') {
        require_admin();
        $eventId = app_text($input, 'id', 100) ?: app_id('event');
        $name = app_text($input, 'name', 140);
        $date = app_text($input, 'date', 20);
        $time = app_text($input, 'time', 20);
        $venue = app_text($input, 'venue', 180);
        $city = app_text($input, 'city', 160);
        $price = (float)($input['price'] ?? 0);

        if ($name === '' || $venue === '' || $city === '' || !preg_match('/^\d{4}-\d{2}-\d{2}$/', $date) || !preg_match('/^\d{2}:\d{2}$/', $time) || $price <= 0 || $price > 100000) {
            app_error('Complete all event fields with a valid price.');
        }

        $previous = $pdo->prepare('SELECT price FROM events WHERE id = :id');
        $previous->execute([':id' => $eventId]);
        $oldEvent = $previous->fetch();

        if ($oldEvent && (float)$oldEvent['price'] !== $price) {
            $used = $pdo->prepare('SELECT COUNT(*) FROM bookings WHERE concert_id = :id');
            $used->execute([':id' => $eventId]);
            if ((int)$used->fetchColumn() > 0) {
                app_error('This event has bookings. Cancel those bookings before changing its price.');
            }
        }

        $stmt = $pdo->prepare('
            INSERT INTO events (id, name, event_date, event_time, venue, city, price)
            VALUES (:id, :name, :event_date, :event_time, :venue, :city, :price)
            ON DUPLICATE KEY UPDATE
                name = VALUES(name),
                event_date = VALUES(event_date),
                event_time = VALUES(event_time),
                venue = VALUES(venue),
                city = VALUES(city),
                price = VALUES(price)
        ');
        $stmt->execute([
            ':id' => $eventId,
            ':name' => $name,
            ':event_date' => $date,
            ':event_time' => $time,
            ':venue' => $venue,
            ':city' => $city,
            ':price' => $price,
        ]);

        app_json(app_state($pdo));
    }

    if ($action === 'delete_event') {
        require_admin();
        $eventId = app_text($input, 'id', 100);
        $used = $pdo->prepare('SELECT COUNT(*) FROM bookings WHERE concert_id = :id');
        $used->execute([':id' => $eventId]);
        if ((int)$used->fetchColumn() > 0) {
            app_error('This event has bookings. Cancel them before deleting the event.');
        }

        $stmt = $pdo->prepare('DELETE FROM events WHERE id = :id');
        $stmt->execute([':id' => $eventId]);
        app_json(app_state($pdo));
    }

    app_error('Unknown API action.', 404);
} catch (Throwable $error) {
    app_error('Server error: ' . $error->getMessage(), 500);
}
