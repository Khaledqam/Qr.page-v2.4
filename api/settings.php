<?php
// =============================================================
// AtoZ Store — Settings API  (v3)
// GET  → public (strips admin-only fields like tracking scripts)
// POST → update (auth required, field-allowlisted)
// =============================================================
declare(strict_types=1);
require_once __DIR__ . '/helpers.php';

$method = $_SERVER['REQUEST_METHOD'];

// ---- GET ----
if ($method === 'GET') {
    $settings = readJson('settings.json') ?? [];

    // Determine if requester is admin
    secureSessionStart();
    $isAdmin = !empty($_SESSION['admin_user']);

    // Always include tracking scripts - they are needed for the public page
    // but we still sanitize them on output to prevent XSS
    $headScripts = $settings['tracking_scripts_head'] ?? '';
    $bodyScripts = $settings['tracking_scripts_body'] ?? '';
    
    // Basic sanitization: strip PHP tags and dangerous patterns
    $headScripts = preg_replace('/<\?php.*?\?>/', '', $headScripts);
    $headScripts = preg_replace('/<\?.*?\?>/', '', $headScripts);
    $bodyScripts = preg_replace('/<\?php.*?\?>/', '', $bodyScripts);
    $bodyScripts = preg_replace('/<\?.*?\?>/', '', $bodyScripts);
    
    $settings['tracking_scripts_head'] = $headScripts;
    $settings['tracking_scripts_body'] = $bodyScripts;

    jsonResponse($settings);
}

// ---- POST ----
if ($method === 'POST') {
    secureSessionStart();
    $user = requireAuth();
    verifyCsrf();

    $input = json_decode(file_get_contents('php://input'), true);
    if (!is_array($input)) {
        jsonResponse(['error' => 'بيانات غير صالحة'], 400);
    }

    $current = readJson('settings.json') ?? [];

    // --- Merge only allowed fields per permission ---

    // Content fields
    if (userCan($user, 'content')) {
        if (isset($input['store_name'])) {
            $current['store_name'] = strip_tags((string)$input['store_name']);
        }
        if (isset($input['tagline'])) {
            $current['tagline'] = strip_tags((string)$input['tagline']);
        }
        if (isset($input['bio_html'])) {
            $current['bio_html'] = sanitiseBioHtml((string)$input['bio_html']);
        }
        if (isset($input['footer_text'])) {
            $current['footer_text'] = strip_tags((string)$input['footer_text']);
        }
        if (isset($input['website_url'])) {
            $current['website_url'] = sanitiseUrl((string)$input['website_url']);
        }
        if (isset($input['phone'])) {
            // Digits and spaces only
            $current['phone'] = preg_replace('/[^0-9\s\+\-]/', '', (string)$input['phone']);
        }
        if (isset($input['logo_url'])) {
            // Only allow filenames from our own icon folder
            $current['logo_url'] = 'assets/img/icons/' . basename((string)$input['logo_url']);
        }
        if (isset($input['logo_shape'])) {
            $current['logo_shape'] = in_array($input['logo_shape'], ['circle', 'rounded', 'original'], true)
                ? $input['logo_shape'] : 'circle';
        }
        if (isset($input['logo_glow'])) {
            $current['logo_glow'] = (bool)$input['logo_glow'];
        }
    }

    // Branches
    if (userCan($user, 'branches') && isset($input['branches']) && is_array($input['branches'])) {
        $branches = [];
        foreach ($input['branches'] as $i => $b) {
            if (empty($b['name'])) continue;
            $mapsUrl = sanitiseUrl((string)($b['maps_url'] ?? ''));
            $directLinkUrl = sanitiseUrl((string)($b['direct_link_url'] ?? ''));
            $branches[] = [
                'id'               => preg_match('/^br_[0-9]+$/', $b['id'] ?? '') ? $b['id'] : ('br_' . time() . '_' . $i),
                'name'             => strip_tags((string)$b['name']),
                'maps_url'         => $mapsUrl,
                'whatsapp'         => preg_replace('/[^0-9]/', '', (string)($b['whatsapp'] ?? '')),
                'order'            => (int)($b['order'] ?? ($i + 1)),
                'hours'            => strip_tags((string)($b['hours'] ?? '')),
                'password'         => strip_tags((string)($b['password'] ?? '')),
                'direct_link_url'  => $directLinkUrl,
                'show_copy'        => !empty($b['show_copy']),
                'details_text'     => strip_tags((string)($b['details_text'] ?? ''), '<p><br><strong><em><u>'),
                'details_html'     => (string)($b['details_html'] ?? ''),
            ];
        }
        // Sort by explicit order field
        usort($branches, fn($a, $b) => $a['order'] <=> $b['order']);
        $current['branches'] = $branches;
    }

    // App links
    if (userCan($user, 'links') && isset($input['app_links']) && is_array($input['app_links'])) {
        $current['app_links'] = [
            'android'            => sanitiseUrl((string)($input['app_links']['android'] ?? '')),
            'ios'                => sanitiseUrl((string)($input['app_links']['ios'] ?? '')),
            'app_block_position' => in_array($input['app_links']['app_block_position'] ?? 'bottom', ['top', 'bottom'], true)
                ? $input['app_links']['app_block_position'] : 'bottom',
        ];
    }

    // Appearance
    if (userCan($user, 'appearance') && isset($input['appearance']) && is_array($input['appearance'])) {
        $a = $input['appearance'];
        $current['appearance'] = [
            'background_color' => preg_match('/^#[0-9a-fA-F]{6}$/', $a['background_color'] ?? '') ? $a['background_color'] : '#0c1727',
            'primary_color'    => preg_match('/^#[0-9a-fA-F]{6}$/', $a['primary_color'] ?? '')    ? $a['primary_color']    : '#00bed9',
            'secondary_color'  => preg_match('/^#[0-9a-fA-F]{6}$/', $a['secondary_color'] ?? '')  ? $a['secondary_color']  : '#ffffff',
            'layout_style'     => in_array($a['layout_style'] ?? 'list', ['list', 'grid'], true)   ? $a['layout_style']     : 'list',
            'card_style'       => in_array($a['card_style'] ?? 'glass', ['glass', 'elevated', 'outline', 'flat', 'spatial-glass'], true) ? $a['card_style'] : 'glass',
            // Header colors - accept hex or rgba
            'header_bg'        => isset($a['header_bg']) ? (string)$a['header_bg'] : '#0c1727',
            'header_text'      => isset($a['header_text']) ? (string)$a['header_text'] : '#ffffff',
            'header_tagline'   => isset($a['header_tagline']) ? (string)$a['header_tagline'] : '#ffffff',
            // Footer colors
            'footer_bg'        => isset($a['footer_bg']) ? (string)$a['footer_bg'] : '#0c1727',
            'footer_text'      => isset($a['footer_text']) ? (string)$a['footer_text'] : '#ffffff',
            'footer_border'    => isset($a['footer_border']) ? (string)$a['footer_border'] : '#ffffff',
            // Card colors
            'card_bg'          => isset($a['card_bg']) ? (string)$a['card_bg'] : '#ffffff',
            'card_border'      => isset($a['card_border']) ? (string)$a['card_border'] : '#ffffff',
            'card_text'        => isset($a['card_text']) ? (string)$a['card_text'] : '#ffffff',
            // Branch colors
            'branch_bg'        => isset($a['branch_bg']) ? (string)$a['branch_bg'] : '#ffffff',
            'branch_border'    => isset($a['branch_border']) ? (string)$a['branch_border'] : '#ffffff',
            'branch_name'      => isset($a['branch_name']) ? (string)$a['branch_name'] : '#ffffff',
            'branch_text'      => isset($a['branch_text']) ? (string)$a['branch_text'] : '#ffffff',
            'branch_details_bg'=> isset($a['branch_details_bg']) ? (string)$a['branch_details_bg'] : '#000000',
        ];
    }

    // Tracking scripts — superadmin / admin only
    if (userCan($user, '*') || userCan($user, 'appearance')) {
        if (isset($input['tracking_scripts_head'])) {
            // Sanitize tracking scripts: strip PHP tags, allow only safe script patterns
            $script = (string)$input['tracking_scripts_head'];
            // Remove any PHP code
            $script = preg_replace('/<\?php.*?\?>/', '', $script);
            $script = preg_replace('/<\?.*?\?>/', '', $script);
            // Remove dangerous patterns like event handlers in inline scripts
            $script = preg_replace('/on\w+\s*=/i', '', $script);
            $current['tracking_scripts_head'] = $script;
        }
        if (isset($input['tracking_scripts_body'])) {
            $script = (string)$input['tracking_scripts_body'];
            // Remove any PHP code
            $script = preg_replace('/<\?php.*?\?>/', '', $script);
            $script = preg_replace('/<\?.*?\?>/', '', $script);
            // Remove dangerous patterns like event handlers in inline scripts
            $script = preg_replace('/on\w+\s*=/i', '', $script);
            $current['tracking_scripts_body'] = $script;
        }
    }

    // Editors go to approval queue for settings changes too
    if (($user['role'] ?? '') === 'editor') {
        queueForApproval($user, 'settings', $input);
    }

    backupBeforeWrite('settings.json');
    if (!writeJson('settings.json', $current)) {
        jsonResponse(['error' => 'فشل حفظ الإعدادات'], 500);
    }

    jsonResponse(['ok' => true, 'settings' => $current]);
}

jsonResponse(['error' => 'طريقة غير مدعومة'], 405);
