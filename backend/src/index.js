// backend/src/index.js or index.js
export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const path = url.pathname;
    const method = request.method;

    // 1. CORS Headers
    const corsHeaders = {
      "Access-Control-Allow-Origin": "*", // Replace with your production domain if needed
      "Access-Control-Allow-Methods": "GET, HEAD, POST, PUT, PATCH, DELETE, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Authorization",
    };

    // Handle OPTIONS Preflight request
    if (method === "OPTIONS") {
      return new Response(null, { headers: corsHeaders });
    }

    // Helper function to return JSON response
    const jsonResponse = (data, status = 200) => {
      return new Response(JSON.stringify(data), {
        status,
        headers: { "Content-Type": "application/json", ...corsHeaders }
      });
    };

    try {
      const db = env.meassnea_db; // Matches wrangler.toml binding

      if (!db) {
        return jsonResponse({ error: "Database binding 'meassnea_db' not found." }, 500);
      }

      // --- ROUTING PATHS ---

      // ----------------------------------------------------
      // PRODUCTS API
      // ----------------------------------------------------
      if (path === "/api/products") {
        if (method === "GET") {
          const { results } = await db.prepare("SELECT * FROM products ORDER BY name ASC").all();
          return jsonResponse(results);
        }
        if (method === "POST") {
          const body = await request.json();
          const { id, name, category, size, quantity, initial_quantity, unit_price, cost_price, min_stock_level } = body;
          
          await db.prepare(`
            INSERT INTO products (id, name, category, size, quantity, initial_quantity, unit_price, cost_price, min_stock_level)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
          `).bind(id, name, category, size, quantity || 0, initial_quantity || 0, unit_price || 0, cost_price || 0, min_stock_level || 0).run();
          
          return jsonResponse({ success: true, id }, 201);
        }
      }

      if (path.startsWith("/api/products/")) {
        const id = path.split("/").pop();
        if (method === "PUT") {
          const body = await request.json();
          const { name, category, size, quantity, unit_price, cost_price, min_stock_level } = body;
          
          await db.prepare(`
            UPDATE products 
            SET name = ?, category = ?, size = ?, quantity = ?, unit_price = ?, cost_price = ?, min_stock_level = ?, updated_at = CURRENT_TIMESTAMP
            WHERE id = ?
          `).bind(name, category, size, quantity, unit_price, cost_price, min_stock_level, id).run();
          
          return jsonResponse({ success: true });
        }
        if (method === "DELETE") {
          await db.prepare("DELETE FROM products WHERE id = ?").bind(id).run();
          return jsonResponse({ success: true }, 200);
        }
      }

      // ----------------------------------------------------
      // MATERIALS API
      // ----------------------------------------------------
      if (path === "/api/materials") {
        if (method === "GET") {
          const { results } = await db.prepare("SELECT * FROM materials").all();
          return jsonResponse(results);
        }
      }

      if (path === "/api/material-transactions") {
        if (method === "GET") {
          const { results } = await db.prepare("SELECT * FROM material_transactions ORDER BY transaction_date DESC").all();
          return jsonResponse(results);
        }
        if (method === "POST") {
          const body = await request.json();
          const { id, material_id, material_name, size, quantity, unit_price, total_price, type, notes } = body;
          
          await db.prepare(`
            INSERT INTO material_transactions (id, material_id, material_name, size, quantity, unit_price, total_price, type, notes)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
          `).bind(id, material_id, material_name, size || 'N/A', quantity, unit_price, total_price, type, notes).run();
          
          return jsonResponse({ success: true, id }, 201);
        }
      }

      // ----------------------------------------------------
      // ORDERS & ORDER ITEMS API
      // ----------------------------------------------------
      if (path === "/api/orders") {
        if (method === "GET") {
          // Fetch orders and resolve associated items
          const { results: orders } = await db.prepare("SELECT * FROM orders ORDER BY order_date DESC").all();
          const { results: items } = await db.prepare("SELECT * FROM order_items").all();
          
          // Map items to their respective orders
          const ordersWithItems = orders.map(order => ({
            ...order,
            items: items.filter(item => item.order_id === order.id)
          }));
          
          return jsonResponse(ordersWithItems);
        }
        if (method === "POST") {
          const body = await request.json();
          const { id, order_number, customer, total, delivery_cost, plastic_bag_qty, case_box_qty, payment_method, status, order_date, items } = body;
          
          // Use a batch transaction sequence for adding order and child items
          const statements = [
            db.prepare(`
              INSERT INTO orders (id, order_number, customer, total, delivery_cost, plastic_bag_qty, case_box_qty, payment_method, status, order_date)
              VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            `).bind(id, order_number, customer, total, delivery_cost || 0, plastic_bag_qty || 0, case_box_qty || 0, payment_method || 'cash', status || 'pending', order_date || new Date().toISOString())
          ];

          if (items && Array.isArray(items)) {
            for (const item of items) {
              statements.push(
                db.prepare(`
                  INSERT INTO order_items (id, order_id, product_id, product_name, quantity, unit_price, cost_price, total)
                  VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                `).bind(item.id, id, item.product_id, item.product_name, item.quantity, item.unit_price, item.cost_price || 0, item.total)
              );
            }
          }

          await db.batch(statements);
          return jsonResponse({ success: true, id }, 201);
        }
      }

      if (path.startsWith("/api/orders/")) {
        const id = path.split("/").pop();
        if (method === "PATCH") {
          const body = await request.json();
          const { status } = body;
          
          await db.prepare(`
            UPDATE orders 
            SET status = ?, updated_at = CURRENT_TIMESTAMP 
            WHERE id = ?
          `).bind(status, id).run();
          
          return jsonResponse({ success: true });
        }
        if (method === "DELETE") {
          // Cascades to order_items automatically via FOREIGN KEY setup
          await db.prepare("DELETE FROM orders WHERE id = ?").bind(id).run();
          return jsonResponse({ success: true });
        }
      }

      // ----------------------------------------------------
      // INCOMES API
      // ----------------------------------------------------
      if (path === "/api/incomes") {
        if (method === "GET") {
          const { results } = await db.prepare("SELECT * FROM incomes ORDER BY income_date DESC").all();
          return jsonResponse(results);
        }
        if (method === "POST") {
          const body = await request.json();
          const { id, order_id, amount, category, payment_method, description, customer, reference, income_date } = body;
          
          await db.prepare(`
            INSERT INTO incomes (id, order_id, amount, category, payment_method, description, customer, reference, income_date)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
          `).bind(id, order_id, amount, category, payment_method, description, customer, reference, income_date).run();
          
          return jsonResponse({ success: true, id }, 201);
        }
      }

      // ----------------------------------------------------
      // EXPENSES API
      // ----------------------------------------------------
      if (path === "/api/expenses") {
        if (method === "GET") {
          const { results } = await db.prepare("SELECT * FROM expenses ORDER BY expense_date DESC").all();
          return jsonResponse(results);
        }
        if (method === "POST") {
          const body = await request.json();
          const { id, amount, category, description, payment_method, vendor, reference, expense_date } = body;
          
          await db.prepare(`
            INSERT INTO expenses (id, amount, category, description, payment_method, vendor, reference, expense_date)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
          `).bind(id, amount, category, description, payment_method, vendor, reference, expense_date).run();
          
          return jsonResponse({ success: true, id }, 201);
        }
      }

      if (path.startsWith("/api/expenses/")) {
        const id = path.split("/").pop();
        if (method === "DELETE") {
          await db.prepare("DELETE FROM expenses WHERE id = ?").bind(id).run();
          return jsonResponse({ success: true });
        }
      }

      // ----------------------------------------------------
      // ASSETS API
      // ----------------------------------------------------
      if (path === "/api/assets") {
        if (method === "GET") {
          const { results } = await db.prepare("SELECT * FROM assets ORDER BY purchase_date DESC").all();
          return jsonResponse(results);
        }
        if (method === "POST") {
          const body = await request.json();
          const { id, name, category, location, assigned_to, vendor, value, description, purchase_date, status } = body;
          
          await db.prepare(`
            INSERT INTO assets (id, name, category, location, assigned_to, vendor, value, description, purchase_date, status)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          `).bind(id, name, category, location, assigned_to, vendor, value, description, purchase_date, status || 'active').run();
          
          return jsonResponse({ success: true, id }, 201);
        }
      }

      if (path.startsWith("/api/assets/")) {
        const id = path.split("/").pop();
        if (method === "PUT") {
          const body = await request.json();
          const { name, category, location, assigned_to, vendor, value, description, purchase_date, status } = body;
          
          await db.prepare(`
            UPDATE assets 
            SET name = ?, category = ?, location = ?, assigned_to = ?, vendor = ?, value = ?, description = ?, purchase_date = ?, status = ?, updated_at = CURRENT_TIMESTAMP
            WHERE id = ?
          `).bind(name, category, location, assigned_to, vendor, value, description, purchase_date, status, id).run();
          
          return jsonResponse({ success: true });
        }
        if (method === "DELETE") {
          await db.prepare("DELETE FROM assets WHERE id = ?").bind(id).run();
          return jsonResponse({ success: true });
        }
      }

      // ----------------------------------------------------
      // INVENTORY MOVEMENTS API
      // ----------------------------------------------------
      if (path === "/api/inventory-movements") {
        if (method === "GET") {
          const { results } = await db.prepare("SELECT * FROM inventory_movements ORDER BY movement_date DESC").all();
          return jsonResponse(results);
        }
        if (method === "POST") {
          const body = await request.json();
          const { id, product_id, product_name, type, quantity, previous_quantity, new_quantity, unit_price, total_value, reference, reference_id, notes } = body;
          
          await db.prepare(`
            INSERT INTO inventory_movements (id, product_id, product_name, type, quantity, previous_quantity, new_quantity, unit_price, total_value, reference, reference_id, notes)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          `).bind(id, product_id, product_name, type, quantity, previous_quantity, new_quantity, unit_price, total_value, reference, reference_id, notes).run();
          
          return jsonResponse({ success: true, id }, 201);
        }
      }

      // ----------------------------------------------------
      // PURCHASE ORDERS API
      // ----------------------------------------------------
      if (path === "/api/purchase-orders") {
        if (method === "GET") {
          const { results } = await db.prepare("SELECT * FROM purchase_orders ORDER BY created_at DESC").all();
          return jsonResponse(results);
        }
        if (method === "POST") {
          const body = await request.json();
          const { id, vendor, total, status, items, notes } = body;
          
          await db.prepare(`
            INSERT INTO purchase_orders (id, vendor, total, status, items, notes)
            VALUES (?, ?, ?, ?, ?, ?)
          `).bind(id, vendor, total || 0, status || 'pending', JSON.stringify(items), notes).run();
          
          return jsonResponse({ success: true, id }, 201);
        }
      }

      if (path.startsWith("/api/purchase-orders/")) {
        const id = path.split("/").pop();
        if (method === "PATCH") {
          const body = await request.json();
          const { status, received_at } = body;
          
          await db.prepare(`
            UPDATE purchase_orders 
            SET status = ?, received_at = ?, updated_at = CURRENT_TIMESTAMP 
            WHERE id = ?
          `).bind(status, received_at, id).run();
          
          return jsonResponse({ success: true });
        }
      }

      // ----------------------------------------------------
      // CATEGORIES API
      // ----------------------------------------------------
      if (path === "/api/categories") {
        if (method === "GET") {
          const { results } = await db.prepare("SELECT * FROM categories").all();
          return jsonResponse(results);
        }
      }

      // Default: Not found
      return jsonResponse({ error: "Endpoint or Method not found" }, 404);

    } catch (err) {
      return jsonResponse({ error: err.message }, 500);
    }
  },
};