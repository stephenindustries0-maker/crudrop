import { neon } from '@neondatabase/serverless';
import webpush from 'web-push';

// HARDCODED DATABASE URL
const sql = neon("PASTE_YOUR_NEON_STRING_HERE");

// VAPID KEYS FOR PUSH NOTIFICATIONS
// (Note: Generate your own at https://web-push-codelab.glitch.me/ for production)
webpush.setVapidDetails(
  'mailto:admin@crudrop.com',
  'BEl62iUYgUivxIkv69yViEuiBIa-Ib9-SkvMeAtA3LFgDzkrxZJjSgSnfckjBJuBkr3qBUYIHBQFLXYp5Nksh8U',
  'UUxI4O8-FbRouAevSmBQ6o_61gR8vcz7N2C1q83N14s'
);

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, OPTIONS');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const url = req.url || '';

  try {
    // --- 1. GET MENU ---
    if (req.method === 'GET' && url.includes('get-menu')) {
      const menu = await sql`SELECT * FROM menu WHERE is_available = true ORDER BY category, name`;
      return res.status(200).json(menu);
    }

    // --- 2. ADMIN UPDATE MENU ---
    if (req.method === 'PUT' && url.includes('update-menu')) {
      const { id, price, is_available } = req.body;
      await sql`UPDATE menu SET price = ${price}, is_available = ${is_available} WHERE id = ${id}`;
      return res.status(200).json({ success: true });
    }

    // --- 3. CREATE LAUNDRY BOOKING ---
    if (req.method === 'POST' && url.includes('create-laundry')) {
      const { code, studentId, tops, bottoms, total } = req.body;
      await sql`
        INSERT INTO laundry_bookings (booking_code, student_id, tops_qty, bottoms_qty, total_amount)
        VALUES (${code}, ${studentId}, ${tops}, ${bottoms}, ${total})
      `;
      return res.status(201).json({ success: true });
    }

    // --- 4. AUTO-PROFILE & STREAK UPDATE ---
    if (req.method === 'POST' && url.includes('auto-profile')) {
      const { name, phone, hostel, room } = req.body;
      
      // Check if user exists
      const existingUser = await sql`SELECT * FROM students WHERE phone = ${phone}`;
      
      if (existingUser.length > 0) {
        // Update streak logic
        const user = existingUser[0];
        const today = new Date().toISOString().split('T')[0];
        const lastOrder = user.last_order_date ? new Date(user.last_order_date).toISOString().split('T')[0] : null;
        
        let newStreak = user.streak;
        if (lastOrder !== today) {
          // If last order was yesterday, increase streak. Otherwise reset to 1.
          const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0];
          newStreak = (lastOrder === yesterday) ? user.streak + 1 : 1;
        }

        const updated = await sql`
          UPDATE students 
          SET full_name = ${name}, hostel = ${hostel}, room = ${room}, streak = ${newStreak}, last_order_date = ${today}::date
          WHERE phone = ${phone} RETURNING *
        `;
        return res.status(200).json({ success: true, user: updated[0] });
      } else {
        // New user: streak starts at 1
        const today = new Date().toISOString().split('T')[0];
        const newUser = await sql`
          INSERT INTO students (full_name, phone, hostel, room, streak, last_order_date)
          VALUES (${name}, ${phone}, ${hostel}, ${room}, 1, ${today}::date) RETURNING *
        `;
        return res.status(201).json({ success: true, user: newUser[0] });
      }
    }

    // --- 5. CREATE ORDER & SEND PUSH NOTIFICATION ---
    if (req.method === 'POST' && url.includes('create-order')) {
      const { code, studentId, senderName, total, items, receipt } = req.body;
      await sql`
        INSERT INTO orders (order_code, student_id, sender_name, total_amount, items_json, receipt_url)
        VALUES (${code}, ${studentId}, ${senderName}, ${total}, ${JSON.stringify(items)}, ${receipt})
      `;

      // Send Push Notification to Admin (if subscriptions exist)
      const subs = await sql`SELECT * FROM push_subscriptions`;
      const payload = JSON.stringify({
        title: "New CruDrop Order!",
        body: `₦${total} order from ${senderName}. Code: ${code}`,
        url: '/admin.html'
      });
      
      subs.forEach(sub => {
        const pushSub = { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } };
        webpush.sendNotification(pushSub, payload).catch(err => console.log(err));
      });

      return res.status(201).json({ success: true });
    }

    // --- 6. SAVE PUSH SUBSCRIPTION ---
    if (req.method === 'POST' && url.includes('subscribe')) {
      const { endpoint, keys } = req.body;
      await sql`
        INSERT INTO push_subscriptions (endpoint, p256dh, auth)
        VALUES (${endpoint}, ${keys.p256dh}, ${keys.auth})
        ON CONFLICT (endpoint) DO NOTHING
      `;
      return res.status(201).json({ success: true });
    }

    // --- 7. GET ORDERS (ADMIN) ---
    if (req.method === 'GET' && url.includes('get-orders')) {
      const orders = await sql`
        SELECT o.*, s.full_name, s.phone, s.hostel, s.room 
        FROM orders o JOIN students s ON o.student_id = s.id 
        ORDER BY o.created_at DESC
      `;
      return res.status(200).json(orders);
    }

    // --- 8. GET STUDENTS (ADMIN) ---
    if (req.method === 'GET' && url.includes('get-students')) {
      const students = await sql`SELECT * FROM students ORDER BY created_at DESC`;
      return res.status(200).json(students);
    }

    // --- 9. APPROVE ORDER (ADMIN) ---
    if (req.method === 'PUT' && url.includes('approve-order')) {
      const { code, status } = req.body;
      await sql`UPDATE orders SET status = ${status} WHERE order_code = ${code}`;
      if (status === 'verified') {
        await sql`
          UPDATE students SET points = points + 5 
          WHERE id = (SELECT student_id FROM orders WHERE order_code = ${code})
        `;
      }
      return res.status(200).json({ success: true });
    }

    return res.status(404).json({ error: "API route not found" });
    
  } catch (error) {
    console.error("DATABASE ERROR:", error);
    return res.status(500).json({ error: error.message });
  }
}