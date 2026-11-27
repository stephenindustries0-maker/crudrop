const { neon } = require('@neondatabase/serverless');
const sql = neon(process.env.DATABASE_URL);

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  
  const { name, hostel, room, senderName, transferRef, items, totals } = req.body;
  
  try {
    // 1. Create or find student
    let studentRes = await sql`SELECT id FROM students WHERE full_name = ${name} LIMIT 1`;
    let studentId;
    if (studentRes.length === 0) {
      const newStudent = await sql`INSERT INTO students (full_name, hostel, room) VALUES (${name}, ${hostel}, ${room}) RETURNING id`;
      studentId = newStudent[0].id;
    } else {
      studentId = studentRes[0].id;
    }

    // 2. Generate 4-digit order code
    const code = Math.floor(1000 + Math.random() * 9000).toString();

    // 3. Save Order
    const orderRes = await sql`
      INSERT INTO orders (
        code, student_id, items_json, portions, spaghetti_total, 
        food_subtotal, delivery_fee, transfer_fee, total_due, 
        sender_name, transfer_ref
      ) VALUES (
        ${code}, ${studentId}, ${JSON.stringify(items)}, ${totals.portions}, ${totals.spaghettiTotal},
        ${totals.foodSubtotal}, ${totals.delivery}, 30, ${totals.total},
        ${senderName}, ${transferRef}
      ) RETURNING id
    `;

    res.status(200).json({ success: true, code: code, orderId: orderRes[0].id });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Database error', details: error.message });
  }
};