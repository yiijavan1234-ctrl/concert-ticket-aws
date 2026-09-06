<?php
declare(strict_types=1);

require_once __DIR__ . '/db.php';

app_start_session();

try {
    $pdo = db();
    $action = (string)($_GET['action'] ?? $_POST['action'] ?? '');
    $input = app_input();

    if ($action === 'status') {
        $profile = app_current_profile($pdo);
        app_json([
            'ok' => true,
            'profile' => $profile,
            'accounts' => [],
            'bookings' => app_bookings($pdo, $profile['id'] ?? null),
            'admin' => !empty($_SESSION['admin_signed_in']),
        ]);
    }

    if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
        app_error('Use POST for this action.', 405);
    }

    if ($action === 'create_account') {
        $fullName = app_text($input, 'fullName', 120);
        $email = strtolower(app_text($input, 'email', 180));
        $password = (string)($input['password'] ?? '');
        $phone = app_text($input, 'phone', 40);
        $city = app_text($input, 'city', 120);

        if ($fullName === '' || !filter_var($email, FILTER_VALIDATE_EMAIL) || $phone === '' || strlen($password) < 6) {
            app_error('Enter your details and a password with at least 6 characters.');
        }

        $exists = $pdo->prepare('SELECT COUNT(*) FROM profiles WHERE email = :email');
        $exists->execute([':email' => $email]);
        if ((int)$exists->fetchColumn() > 0) {
            app_error('An account with this email already exists. Sign in or use another email.');
        }

        $profileId = app_id('profile');
        $stmt = $pdo->prepare('
            INSERT INTO profiles (id, full_name, email, password_hash, phone, city)
            VALUES (:id, :full_name, :email, :password_hash, :phone, :city)
        ');
        $stmt->execute([
            ':id' => $profileId,
            ':full_name' => $fullName,
            ':email' => $email,
            ':password_hash' => password_hash($password, PASSWORD_DEFAULT),
            ':phone' => $phone,
            ':city' => $city,
        ]);

        app_json(['ok' => true, 'accounts' => [], 'message' => 'Account created.']);
    }

    if ($action === 'sign_in') {
        $email = strtolower(app_text($input, 'email', 180));
        $password = (string)($input['password'] ?? '');
        $stmt = $pdo->prepare('SELECT id, password_hash FROM profiles WHERE email = :email');
        $stmt->execute([':email' => $email]);
        $row = $stmt->fetch();
        if (!$row || !$row['password_hash'] || !password_verify($password, $row['password_hash'])) {
            app_error('Email or password is incorrect.', 401);
        }

        $_SESSION['profile_id'] = $row['id'];
        $profile = app_current_profile($pdo);
        app_json([
            'ok' => true,
            'profile' => $profile,
            'accounts' => [],
            'bookings' => app_bookings($pdo, $profile['id'] ?? null),
        ]);
    }

    if ($action === 'sign_out') {
        unset($_SESSION['profile_id']);
        app_json(['ok' => true]);
    }

    if ($action === 'admin_sign_in') {
        $username = app_text($input, 'username', 100);
        $password = (string)($input['password'] ?? '');
        if (!hash_equals(ADMIN_USERNAME, $username) || !hash_equals(ADMIN_PASSWORD, $password)) {
            app_error('Incorrect username or password.', 401);
        }

        $_SESSION['admin_signed_in'] = true;
        app_json(['ok' => true, 'admin' => true]);
    }

    if ($action === 'admin_sign_out') {
        unset($_SESSION['admin_signed_in']);
        app_json(['ok' => true, 'admin' => false]);
    }

    app_error('Unknown auth action.', 404);
} catch (Throwable $error) {
    app_error('Server error: ' . $error->getMessage(), 500);
}
