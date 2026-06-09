var __defProp = Object.defineProperty;
var __name = (target, value) => __defProp(target, "name", { value, configurable: true });

// src/index.js
var src_default = {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const path = url.pathname;
    const method = request.method;
    const corsHeaders = {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, HEAD, POST, PUT, PATCH, DELETE, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Authorization"
    };
    if (method === "OPTIONS") {
      return new Response(null, { headers: corsHeaders });
    }
    const jsonResponse = /* @__PURE__ */ __name((data, status = 200) => {
      return new Response(JSON.stringify(data), {
        status,
        headers: { "Content-Type": "application/json", ...corsHeaders }
      });
    }, "jsonResponse");
    const getVal = /* @__PURE__ */ __name((obj, camelKey, snakeKey, defaultVal = "") => {
      if (!obj) return defaultVal;
      if (obj[camelKey] !== void 0 && obj[camelKey] !== null) return obj[camelKey];
      if (obj[snakeKey] !== void 0 && obj[snakeKey] !== null) return obj[snakeKey];
      return defaultVal;
    }, "getVal");
    const getNum = /* @__PURE__ */ __name((obj, camelKey, snakeKey, defaultVal = 0) => {
      const val = getVal(obj, camelKey, snakeKey, null);
      if (val === null || val === "") return defaultVal;
      const num = Number(val);
      return isNaN(num) ? defaultVal : num;
    }, "getNum");
    const sanitize = /* @__PURE__ */ __name((val, defaultVal = "") => {
      if (val === void 0 || val === null) return defaultVal;
      return val;
    }, "sanitize");
    const sanitizeNum = /* @__PURE__ */ __name((val, defaultVal = 0) => {
      if (val === void 0 || val === null || val === "") return defaultVal;
      const num = Number(val);
      return isNaN(num) ? defaultVal : num;
    }, "sanitizeNum");
    const getMaterialUnitCost = /* @__PURE__ */ __name(async (materialName, size) => {
      const { results } = await env.meassnea_db.prepare(
        "SELECT unit_price FROM materials WHERE name = ? AND size = ? LIMIT 1"
      ).bind(materialName, size).all();
      return results.length > 0 ? results[0].unit_price : 0;
    }, "getMaterialUnitCost");
    const deductPlasticBag = /* @__PURE__ */ __name(async (size, qty, orderNumber) => {
      const material = await env.meassnea_db.prepare(
        "SELECT * FROM materials WHERE name = 'plastic_bag' AND size = ? LIMIT 1"
      ).bind(size).first();
      if (!material) return null;
      const newQty = material.quantity - qty;
      await env.meassnea_db.prepare(
        "UPDATE materials SET quantity = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?"
      ).bind(newQty, material.id).run();
      const txId = crypto.randomUUID();
      await env.meassnea_db.prepare(`
        INSERT INTO material_transactions (id, material_id, material_name, size, quantity, unit_price, total_price, type, notes, transaction_date)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).bind(txId, material.id, "plastic_bag", size, qty, material.unit_price, qty * material.unit_price, "out", `Order ${orderNumber}`, (/* @__PURE__ */ new Date()).toISOString()).run();
      return { material_id: material.id, previous_quantity: material.quantity, new_quantity: newQty };
    }, "deductPlasticBag");
    const returnPlasticBag = /* @__PURE__ */ __name(async (size, qty, orderNumber) => {
      const material = await env.meassnea_db.prepare(
        "SELECT * FROM materials WHERE name = 'plastic_bag' AND size = ? LIMIT 1"
      ).bind(size).first();
      if (!material) return null;
      const newQty = material.quantity + qty;
      await env.meassnea_db.prepare(
        "UPDATE materials SET quantity = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?"
      ).bind(newQty, material.id).run();
      const txId = crypto.randomUUID();
      await env.meassnea_db.prepare(`
        INSERT INTO material_transactions (id, material_id, material_name, size, quantity, unit_price, total_price, type, notes, transaction_date)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).bind(txId, material.id, "plastic_bag", size, qty, material.unit_price, qty * material.unit_price, "return", `Order cancellation ${orderNumber}`, (/* @__PURE__ */ new Date()).toISOString()).run();
      return { material_id: material.id, previous_quantity: material.quantity, new_quantity: newQty };
    }, "returnPlasticBag");
    const calculatePlasticBagCost = /* @__PURE__ */ __name(async (plasticBags) => {
      let totalCost = 0;
      if (!Array.isArray(plasticBags)) return totalCost;
      for (const bag of plasticBags) {
        if (!bag.size || !bag.qty) continue;
        const unitCost = await getMaterialUnitCost("plastic_bag", bag.size);
        totalCost += unitCost * bag.qty;
      }
      return totalCost;
    }, "calculatePlasticBagCost");
    const deductProductMaterials = /* @__PURE__ */ __name(async (productId, quantity, orderNumber) => {
      const product = await env.meassnea_db.prepare(
        "SELECT * FROM products WHERE id = ?"
      ).bind(productId).first();
      if (!product) return [];
      const deductions = [];
      const TEA_GRAMS_PER_SIZE = { S: 100, M: 200, L: 500 };
      if (product.name === "\u1791\u17B6\u1794\u1794\u17B6\u179A\u17B6\u17C6\u1784") {
        let material = await env.meassnea_db.prepare("SELECT * FROM materials WHERE name = 'tea_powder' LIMIT 1").first();
        if (material) {
          const newQty = material.quantity - quantity;
          await env.meassnea_db.prepare("UPDATE materials SET quantity = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?").bind(newQty, material.id).run();
          const txId = crypto.randomUUID();
          await env.meassnea_db.prepare(`
            INSERT INTO material_transactions (id, material_id, material_name, size, quantity, unit_price, total_price, type, notes, transaction_date)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          `).bind(txId, material.id, "\u1791\u17B6\u1794\u1794\u17B6\u179A\u17B6\u17C6\u1784", "N/A", -quantity, material.unit_price, -(quantity * material.unit_price), "deduction", `Order ${orderNumber} - ${product.name}`, (/* @__PURE__ */ new Date()).toISOString()).run();
          deductions.push({ material_id: material.id, name: "\u1791\u17B6\u1794\u1794\u17B6\u179A\u17B6\u17C6\u1784", new_quantity: newQty });
        }
        return deductions;
      }
      const materialsToDeduct = ["package_bag", "box", "leafleap", "labor"];
      for (const matName of materialsToDeduct) {
        let material = await env.meassnea_db.prepare(
          "SELECT * FROM materials WHERE name = ? AND size = ? LIMIT 1"
        ).bind(matName, product.size || "N/A").first();
        if (material) {
          const newQty = material.quantity - quantity;
          await env.meassnea_db.prepare(
            "UPDATE materials SET quantity = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?"
          ).bind(newQty, material.id).run();
          const txId = crypto.randomUUID();
          await env.meassnea_db.prepare(`
            INSERT INTO material_transactions (id, material_id, material_name, size, quantity, unit_price, total_price, type, notes, transaction_date)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          `).bind(txId, material.id, matName, material.size || "N/A", -quantity, material.unit_price, -(quantity * material.unit_price), "deduction", `Order ${orderNumber} - ${product.name}`, (/* @__PURE__ */ new Date()).toISOString()).run();
          deductions.push({ material_id: material.id, name: matName, new_quantity: newQty });
        }
      }
      const gramsFactor = TEA_GRAMS_PER_SIZE[product.size] || 0;
      if (gramsFactor > 0) {
        const totalGramsDeducted = gramsFactor * quantity;
        const txId = crypto.randomUUID();
        await env.meassnea_db.prepare(`
          INSERT INTO material_transactions (id, material_id, material_name, size, quantity, unit_price, total_price, type, notes, transaction_date)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).bind(txId, "mat_8", "\u178F\u17C2", product.size, totalGramsDeducted, 0, 0, "out", `Order ${orderNumber} - ${product.name} x${quantity} (${totalGramsDeducted}g \u178F\u17C2)`, (/* @__PURE__ */ new Date()).toISOString()).run();
        deductions.push({ material_id: "mat_8", name: "\u178F\u17C2", new_quantity: null });
      }
      return deductions;
    }, "deductProductMaterials");
    try {
      const db = env.meassnea_db;
      if (!db) return jsonResponse({ error: "Database binding 'meassnea_db' not found." }, 500);
      if (path === "/api/products") {
        if (method === "GET") {
          const { results } = await db.prepare("SELECT * FROM products ORDER BY name ASC").all();
          return jsonResponse(results);
        }
        if (method === "POST") {
          const body = await request.json();
          const id = getVal(body, "id", "id", crypto.randomUUID());
          const name = getVal(body, "name", "name", "Unnamed Product");
          const category = getVal(body, "category", "category", "");
          const size = getVal(body, "size", "size", "N/A");
          const quantity = getNum(body, "quantity", "quantity", 0);
          const initial_quantity = getNum(body, "initialQuantity", "initial_quantity", quantity);
          const unit_price = getNum(body, "unitPrice", "unit_price", 0);
          const cost_price = getNum(body, "costPrice", "cost_price", 0);
          const min_stock_level = getNum(body, "minStockLevel", "min_stock_level", 0);
          await db.prepare(`
            INSERT INTO products (id, name, category, size, quantity, initial_quantity, unit_price, cost_price, min_stock_level)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
          `).bind(id, name, category, size, quantity, initial_quantity, unit_price, cost_price, min_stock_level).run();
          return jsonResponse({ success: true, id }, 201);
        }
      }
      if (path.startsWith("/api/products/")) {
        const id = path.split("/").pop();
        if (method === "GET") {
          const product = await db.prepare("SELECT * FROM products WHERE id = ?").bind(id).first();
          return jsonResponse(product || { error: "Product not found" }, product ? 200 : 404);
        }
        if (method === "PUT") {
          const body = await request.json();
          const existing = await db.prepare("SELECT * FROM products WHERE id = ?").bind(id).first();
          if (!existing) return jsonResponse({ error: "Product not found" }, 404);
          const name = getVal(body, "name", "name", existing.name);
          const category = getVal(body, "category", "category", existing.category);
          const size = getVal(body, "size", "size", existing.size);
          const quantity = getNum(body, "quantity", "quantity", existing.quantity);
          const unit_price = getNum(body, "unitPrice", "unit_price", existing.unit_price);
          const cost_price = getNum(body, "costPrice", "cost_price", existing.cost_price);
          const min_stock_level = getNum(body, "minStockLevel", "min_stock_level", existing.min_stock_level);
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
      if (path === "/api/materials") {
        if (method === "GET") {
          const { results } = await db.prepare("SELECT * FROM materials ORDER BY name, size").all();
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
          const id = getVal(body, "id", "id", crypto.randomUUID());
          const material_id = getVal(body, "materialId", "material_id", null);
          const material_name = getVal(body, "materialName", "material_name", "Unknown Material");
          const size = getVal(body, "size", "size", "N/A");
          const quantity = getNum(body, "quantity", "quantity", 0);
          const unit_price = getNum(body, "unitPrice", "unit_price", 0);
          const total_price = getNum(body, "totalPrice", "total_price", quantity * unit_price);
          const type = getVal(body, "type", "type", "in");
          const notes = getVal(body, "notes", "notes", "");
          const transaction_date = getVal(body, "date", "transaction_date", (/* @__PURE__ */ new Date()).toISOString());
          await db.prepare(`
            INSERT INTO material_transactions (id, material_id, material_name, size, quantity, unit_price, total_price, type, notes, transaction_date)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          `).bind(id, material_id, material_name, size, quantity, unit_price, total_price, type, notes, transaction_date).run();
          return jsonResponse({ success: true, id }, 201);
        }
      }
      if (path.startsWith("/api/material-transactions/")) {
        const id = path.split("/").pop();
        if (method === "PUT") {
          const body = await request.json();
          const existing = await db.prepare("SELECT * FROM material_transactions WHERE id = ?").bind(id).first();
          if (!existing) return jsonResponse({ error: "Transaction not found" }, 404);
          const updates = [];
          const params = [];
          if (body.material_name !== void 0) {
            updates.push("material_name = ?");
            params.push(body.material_name);
          }
          if (body.size !== void 0) {
            updates.push("size = ?");
            params.push(body.size);
          }
          if (body.quantity !== void 0) {
            updates.push("quantity = ?");
            params.push(body.quantity);
          }
          if (body.unit_price !== void 0) {
            updates.push("unit_price = ?");
            params.push(body.unit_price);
          }
          if (body.total_price !== void 0) {
            updates.push("total_price = ?");
            params.push(body.total_price);
          }
          if (body.notes !== void 0) {
            updates.push("notes = ?");
            params.push(body.notes);
          }
          if (body.transaction_date !== void 0) {
            updates.push("transaction_date = ?");
            params.push(body.transaction_date);
          }
          params.push(id);
          if (updates.length === 0) {
            return jsonResponse({ error: "No fields to update" }, 400);
          }
          const query = `UPDATE material_transactions SET ${updates.join(", ")} WHERE id = ?`;
          await db.prepare(query).bind(...params).run();
          const updated = await db.prepare("SELECT * FROM material_transactions WHERE id = ?").bind(id).first();
          return jsonResponse(updated);
        }
        if (method === "DELETE") {
          await db.prepare("DELETE FROM material_transactions WHERE id = ?").bind(id).run();
          return jsonResponse({ success: true }, 200);
        }
      }
      if (path === "/api/orders") {
        if (method === "GET") {
          const { results: orders } = await db.prepare("SELECT * FROM orders ORDER BY order_date DESC").all();
          const { results: items } = await db.prepare("SELECT * FROM order_items").all();
          return jsonResponse(orders.map((order) => ({
            ...order,
            items: items.filter((item) => item.order_id === order.id),
            free_items: order.free_items ? JSON.parse(order.free_items) : []
          })));
        }
        if (method === "POST") {
          const body = await request.json();
          const id = getVal(body, "id", "id", crypto.randomUUID());
          const order_number = getVal(body, "orderNumber", "order_number", `ORD-${Date.now()}`);
          const customer = getVal(body, "customer", "customer", "Generic Customer");
          const total = getNum(body, "total", "total", 0);
          const delivery_cost = getNum(body, "deliveryCost", "delivery_cost", 0);
          let rawBags = body.plasticBags || body.plastic_bags || [];
          if (typeof rawBags === "string") {
            try {
              rawBags = JSON.parse(rawBags);
            } catch (e) {
              rawBags = [];
            }
          }
          const validatedBags = Array.isArray(rawBags) ? rawBags.filter((b) => b.size && (b.qty || b.quantity)) : [];
          const payment_method = getVal(body, "paymentMethod", "payment_method", "cash");
          const status = getVal(body, "status", "status", "pending");
          const order_date = getVal(body, "date", "order_date", (/* @__PURE__ */ new Date()).toISOString());
          const case_box_qty = getNum(body, "caseBoxQty", "case_box_qty", 0);
          const items = body.items || [];
          const bagDeductions = [];
          for (const bag of validatedBags) {
            const qty = Number(bag.qty || bag.quantity || 0);
            if (qty > 0) {
              const res = await deductPlasticBag(bag.size, qty, order_number);
              if (res) bagDeductions.push({ size: bag.size, qty, ...res });
            }
          }
          let rawFreeItems = body.freeItems || body.free_items || [];
          if (typeof rawFreeItems === "string") {
            try {
              rawFreeItems = JSON.parse(rawFreeItems);
            } catch (e) {
              rawFreeItems = [];
            }
          }
          const validatedFreeItems = Array.isArray(rawFreeItems) ? rawFreeItems.filter((f) => f.product_id || f.productId) : [];
          for (const item of validatedFreeItems) {
            const pId = item.product_id || item.productId;
            const qty = Number(item.quantity || 1);
            if (pId) {
              const product = await db.prepare("SELECT * FROM products WHERE id = ?").bind(pId).first();
              if (product) {
                await db.prepare("UPDATE products SET quantity = ? WHERE id = ?").bind(product.quantity - qty, pId).run();
                await db.prepare(`
                  INSERT INTO inventory_movements (id, product_id, product_name, type, quantity, previous_quantity, new_quantity, reference, reference_id, notes)
                  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                `).bind(crypto.randomUUID(), pId, product.name, "out", qty, product.quantity, product.quantity - qty, order_number, id, `Free item for ${customer}`).run();
              }
            }
          }
          if (case_box_qty > 0) {
            let boxMat = await db.prepare("SELECT * FROM materials WHERE name = 'case_box' LIMIT 1").first();
            if (boxMat) {
              await db.prepare("UPDATE materials SET quantity = ? WHERE id = ?").bind(boxMat.quantity - case_box_qty, boxMat.id).run();
              await db.prepare(`
                INSERT INTO material_transactions (id, material_name, size, quantity, type, notes)
                VALUES (?, '\u1780\u17C1\u179F', 'N/A', ?, 'out', ?)
              `).bind(crypto.randomUUID(), case_box_qty, `Order ${order_number}`).run();
            }
          }
          const plasticBagCost = await calculatePlasticBagCost(validatedBags.map((b) => ({ size: b.size, qty: Number(b.qty || b.quantity || 0) })));
          const statements = [
            db.prepare(`
              INSERT INTO orders (id, order_number, customer, total, delivery_cost, plastic_bags, plastic_bag_cost, case_box_qty, free_items, payment_method, status, order_date)
              VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            `).bind(
              id,
              order_number,
              customer,
              total,
              delivery_cost,
              JSON.stringify(validatedBags.map((b) => ({ size: b.size, qty: Number(b.qty || b.quantity || 0) }))),
              plasticBagCost,
              case_box_qty,
              JSON.stringify(validatedFreeItems),
              payment_method,
              status,
              order_date
            )
          ];
          if (Array.isArray(items)) {
            for (const item of items) {
              const item_id = getVal(item, "id", "id", crypto.randomUUID());
              const product_id = getVal(item, "productId", "product_id", "");
              const product_name = getVal(item, "productName", "product_name", "");
              const quantity = getNum(item, "quantity", "quantity", 1);
              const unit_price = getNum(item, "unitPrice", "unit_price", 0);
              const cost_price = getNum(item, "costPrice", "cost_price", 0);
              const item_total = getNum(item, "total", "total", quantity * unit_price);
              statements.push(
                db.prepare(`
                  INSERT INTO order_items (id, order_id, product_id, product_name, quantity, unit_price, cost_price, total)
                  VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                `).bind(item_id, id, product_id, product_name, quantity, unit_price, cost_price, item_total)
              );
            }
          }
          await db.batch(statements);
          return jsonResponse({
            success: true,
            id,
            plastic_bag_cost: plasticBagCost,
            bag_deductions: bagDeductions
          }, 201);
        }
      }
      if (path.startsWith("/api/orders/")) {
        const id = path.split("/").pop();
        if (method === "PATCH") {
          const body = await request.json();
          const status = sanitize(body.status, "pending");
          if (status === "cancelled") {
            const order = await db.prepare("SELECT * FROM orders WHERE id = ?").bind(id).first();
            if (order && order.plastic_bags) {
              const bags = JSON.parse(order.plastic_bags);
              for (const bag of bags) {
                await returnPlasticBag(bag.size, Number(bag.qty || bag.quantity || 0), order.order_number);
              }
            }
            if (order && order.free_items) {
              try {
                const freeItems = JSON.parse(order.free_items);
                for (const item of freeItems) {
                  const pId = item.product_id || item.productId;
                  const qty = Number(item.quantity || 1);
                  if (pId && qty > 0) {
                    const product = await db.prepare("SELECT * FROM products WHERE id = ?").bind(pId).first();
                    if (product) {
                      await db.prepare("UPDATE products SET quantity = ? WHERE id = ?").bind(product.quantity + qty, pId).run();
                      await db.prepare(`
                        INSERT INTO inventory_movements (id, product_id, product_name, type, quantity, previous_quantity, new_quantity, reference, reference_id, notes)
                        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                      `).bind(crypto.randomUUID(), pId, product.name, "return", qty, product.quantity, product.quantity + qty, order.order_number, id, "Free item returned - order cancelled").run();
                    }
                  }
                }
              } catch (e) {
                console.error("Error returning free items:", e);
              }
            }
            await db.prepare("DELETE FROM incomes WHERE order_id = ?").bind(id).run();
          }
          await db.prepare(`
            UPDATE orders SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?
          `).bind(status, id).run();
          return jsonResponse({ success: true });
        }
        if (method === "DELETE") {
          const order = await db.prepare("SELECT * FROM orders WHERE id = ?").bind(id).first();
          if (order && order.plastic_bags) {
            const bags = JSON.parse(order.plastic_bags);
            for (const bag of bags) {
              await returnPlasticBag(bag.size, Number(bag.qty || bag.quantity || 0), order.order_number);
            }
          }
          if (order && order.free_items) {
            try {
              const freeItems = JSON.parse(order.free_items);
              for (const item of freeItems) {
                const pId = item.product_id || item.productId;
                const qty = Number(item.quantity || 1);
                if (pId && qty > 0) {
                  const product = await db.prepare("SELECT * FROM products WHERE id = ?").bind(pId).first();
                  if (product) {
                    await db.prepare("UPDATE products SET quantity = ? WHERE id = ?").bind(product.quantity + qty, pId).run();
                  }
                }
              }
            } catch (e) {
              console.error("Error returning free items on delete:", e);
            }
          }
          await db.prepare("DELETE FROM order_items WHERE order_id = ?").bind(id).run();
          await db.prepare("DELETE FROM incomes WHERE order_id = ?").bind(id).run();
          await db.prepare("DELETE FROM orders WHERE id = ?").bind(id).run();
          return jsonResponse({ success: true });
        }
      }
      if (path === "/api/incomes") {
        if (method === "GET") {
          const { results } = await db.prepare("SELECT * FROM incomes ORDER BY income_date DESC").all();
          return jsonResponse(results);
        }
        if (method === "POST") {
          const body = await request.json();
          const id = getVal(body, "id", "id", crypto.randomUUID());
          const order_id = getVal(body, "orderId", "order_id", null);
          const amount = getNum(body, "amount", "amount", 0);
          const category = getVal(body, "category", "category", "\u179B\u1780\u17CB\u1795\u179B\u17B7\u178F\u1795\u179B");
          const payment_method = getVal(body, "paymentMethod", "payment_method", "cash");
          const description = getVal(body, "description", "description", "");
          const customer = getVal(body, "customer", "customer", "");
          const reference = getVal(body, "reference", "reference", "");
          const income_date = getVal(body, "date", "income_date", (/* @__PURE__ */ new Date()).toISOString());
          await db.prepare(`
            INSERT INTO incomes (id, order_id, amount, category, payment_method, description, customer, reference, income_date)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
          `).bind(id, order_id, amount, category, payment_method, description, customer, reference, income_date).run();
          return jsonResponse({ success: true, id }, 201);
        }
      }
      if (path.startsWith("/api/incomes/")) {
        const id = path.split("/").pop();
        if (method === "GET") {
          const income = await db.prepare("SELECT * FROM incomes WHERE id = ?").bind(id).first();
          return jsonResponse(income || { error: "Income not found" }, income ? 200 : 404);
        }
        if (method === "PUT") {
          const body = await request.json();
          const existing = await db.prepare("SELECT * FROM incomes WHERE id = ?").bind(id).first();
          if (!existing) return jsonResponse({ error: "Income not found" }, 404);
          const order_id = getVal(body, "orderId", "order_id", existing.order_id);
          const amount = getNum(body, "amount", "amount", existing.amount);
          const category = getVal(body, "category", "category", existing.category);
          const payment_method = getVal(body, "paymentMethod", "payment_method", existing.payment_method);
          const description = getVal(body, "description", "description", existing.description);
          const customer = getVal(body, "customer", "customer", existing.customer);
          const reference = getVal(body, "reference", "reference", existing.reference);
          const income_date = getVal(body, "date", "income_date", existing.income_date);
          await db.prepare(`
            UPDATE incomes 
            SET order_id = ?, amount = ?, category = ?, payment_method = ?, description = ?, customer = ?, reference = ?, income_date = ?, updated_at = CURRENT_TIMESTAMP
            WHERE id = ?
          `).bind(order_id, amount, category, payment_method, description, customer, reference, income_date, id).run();
          return jsonResponse({ success: true });
        }
        if (method === "PATCH") {
          const body = await request.json();
          const existing = await db.prepare("SELECT * FROM incomes WHERE id = ?").bind(id).first();
          if (!existing) return jsonResponse({ error: "Income not found" }, 404);
          const updates = [];
          const params = [];
          if (body.order_id !== void 0 || body.orderId !== void 0) {
            updates.push("order_id = ?");
            params.push(getVal(body, "orderId", "order_id", existing.order_id));
          }
          if (body.amount !== void 0) {
            updates.push("amount = ?");
            params.push(getNum(body, "amount", "amount", existing.amount));
          }
          if (body.category !== void 0) {
            updates.push("category = ?");
            params.push(getVal(body, "category", "category", existing.category));
          }
          if (body.payment_method !== void 0 || body.paymentMethod !== void 0) {
            updates.push("payment_method = ?");
            params.push(getVal(body, "paymentMethod", "payment_method", existing.payment_method));
          }
          if (body.description !== void 0) {
            updates.push("description = ?");
            params.push(getVal(body, "description", "description", existing.description));
          }
          if (body.customer !== void 0) {
            updates.push("customer = ?");
            params.push(getVal(body, "customer", "customer", existing.customer));
          }
          if (body.reference !== void 0) {
            updates.push("reference = ?");
            params.push(getVal(body, "reference", "reference", existing.reference));
          }
          if (body.income_date !== void 0 || body.date !== void 0) {
            updates.push("income_date = ?");
            params.push(getVal(body, "date", "income_date", existing.income_date));
          }
          params.push(id);
          if (updates.length === 0) {
            return jsonResponse({ error: "No fields to update" }, 400);
          }
          const query = `UPDATE incomes SET ${updates.join(", ")}, updated_at = CURRENT_TIMESTAMP WHERE id = ?`;
          await db.prepare(query).bind(...params).run();
          return jsonResponse({ success: true });
        }
        if (method === "DELETE") {
          await db.prepare("DELETE FROM incomes WHERE id = ?").bind(id).run();
          return jsonResponse({ success: true });
        }
      }
      if (path === "/api/expenses") {
        if (method === "GET") {
          const { results } = await db.prepare("SELECT * FROM expenses ORDER BY expense_date DESC").all();
          return jsonResponse(results);
        }
        if (method === "POST") {
          const body = await request.json();
          const id = getVal(body, "id", "id", crypto.randomUUID());
          const amount = getNum(body, "amount", "amount", 0);
          const category = getVal(body, "category", "category", "");
          const description = getVal(body, "description", "description", "");
          const payment_method = getVal(body, "paymentMethod", "payment_method", "cash");
          const vendor = getVal(body, "vendor", "vendor", "");
          const reference = getVal(body, "reference", "reference", "");
          const expense_date = getVal(body, "date", "expense_date", (/* @__PURE__ */ new Date()).toISOString());
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
      if (path === "/api/assets") {
        if (method === "GET") {
          const { results } = await db.prepare("SELECT * FROM assets ORDER BY purchase_date DESC").all();
          return jsonResponse(results);
        }
        if (method === "POST") {
          const body = await request.json();
          const id = getVal(body, "id", "id", crypto.randomUUID());
          const name = getVal(body, "name", "name", "Unnamed Asset");
          const category = getVal(body, "category", "category", "");
          const location = getVal(body, "location", "location", "");
          const assigned_to = getVal(body, "assignedTo", "assigned_to", "");
          const vendor = getVal(body, "vendor", "vendor", "");
          const value = getNum(body, "value", "value", 0);
          const description = getVal(body, "description", "description", "");
          const purchase_date = getVal(body, "purchaseDate", "purchase_date", null);
          const status = getVal(body, "status", "status", "active");
          await db.prepare(`
            INSERT INTO assets (id, name, category, location, assigned_to, vendor, value, description, purchase_date, status)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          `).bind(id, name, category, location, assigned_to, vendor, value, description, purchase_date, status).run();
          return jsonResponse({ success: true, id }, 201);
        }
      }
      if (path.startsWith("/api/assets/")) {
        const id = path.split("/").pop();
        if (method === "PUT") {
          const body = await request.json();
          const existing = await db.prepare("SELECT * FROM assets WHERE id = ?").bind(id).first();
          if (!existing) return jsonResponse({ error: "Asset not found" }, 404);
          const name = getVal(body, "name", "name", existing.name);
          const category = getVal(body, "category", "category", existing.category);
          const location = getVal(body, "location", "location", existing.location);
          const assigned_to = getVal(body, "assignedTo", "assigned_to", existing.assigned_to);
          const vendor = getVal(body, "vendor", "vendor", existing.vendor);
          const value = getNum(body, "value", "value", existing.value);
          const description = getVal(body, "description", "description", existing.description);
          const purchase_date = getVal(body, "purchaseDate", "purchase_date", existing.purchase_date);
          const status = getVal(body, "status", "status", existing.status);
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
      if (path === "/api/inventory-movements") {
        if (method === "GET") {
          const { results } = await db.prepare("SELECT * FROM inventory_movements ORDER BY movement_date DESC").all();
          return jsonResponse(results);
        }
        if (method === "POST") {
          const body = await request.json();
          const id = getVal(body, "id", "id", crypto.randomUUID());
          const product_id = getVal(body, "productId", "product_id", null);
          const product_name = getVal(body, "productName", "product_name", "");
          const type = getVal(body, "type", "type", "out");
          const quantity = getNum(body, "quantity", "quantity", 0);
          const previous_quantity = getNum(body, "previousQuantity", "previous_quantity", 0);
          const new_quantity = getNum(body, "newQuantity", "new_quantity", 0);
          const unit_price = getNum(body, "unitPrice", "unit_price", 0);
          const total_value = getNum(body, "totalValue", "total_value", quantity * unit_price);
          const reference = getVal(body, "reference", "reference", "");
          const reference_id = getVal(body, "referenceId", "reference_id", "");
          const notes = getVal(body, "notes", "notes", "");
          await db.prepare(`
            INSERT INTO inventory_movements (id, product_id, product_name, type, quantity, previous_quantity, new_quantity, unit_price, total_value, reference, reference_id, notes)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          `).bind(id, product_id, product_name, type, quantity, previous_quantity, new_quantity, unit_price, total_value, reference, reference_id, notes).run();
          return jsonResponse({ success: true, id }, 201);
        }
      }
      if (path === "/api/purchase-orders") {
        if (method === "GET") {
          const { results } = await db.prepare("SELECT * FROM purchase_orders ORDER BY created_at DESC").all();
          return jsonResponse(results);
        }
        if (method === "POST") {
          const body = await request.json();
          const id = getVal(body, "id", "id", crypto.randomUUID());
          const vendor = getVal(body, "vendor", "vendor", "");
          const total = getNum(body, "total", "total", 0);
          const status = getVal(body, "status", "status", "pending");
          const items = body.items ? JSON.stringify(body.items) : "[]";
          const notes = getVal(body, "notes", "notes", "");
          await db.prepare(`
            INSERT INTO purchase_orders (id, vendor, total, status, items, notes)
            VALUES (?, ?, ?, ?, ?, ?)
          `).bind(id, vendor, total, status, items, notes).run();
          return jsonResponse({ success: true, id }, 201);
        }
      }
      if (path.startsWith("/api/purchase-orders/")) {
        const id = path.split("/").pop();
        if (method === "PATCH") {
          const body = await request.json();
          const status = getVal(body, "status", "status", "pending");
          const received_at = getVal(body, "receivedAt", "received_at", null);
          await db.prepare(`
            UPDATE purchase_orders SET status = ?, received_at = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?
          `).bind(status, received_at, id).run();
          return jsonResponse({ success: true });
        }
      }
      if (path === "/api/categories") {
        if (method === "GET") {
          const { results } = await db.prepare("SELECT * FROM categories").all();
          return jsonResponse(results);
        }
      }
      if (path === "/api/settings") {
        if (method === "GET") {
          const { results } = await db.prepare("SELECT * FROM app_settings").all();
          const settings = {};
          results.forEach((row) => {
            settings[row.key] = row.value;
          });
          return jsonResponse(settings);
        }
        if (method === "PUT") {
          const body = await request.json();
          for (const [key, value] of Object.entries(body)) {
            await db.prepare(`
              INSERT INTO app_settings (key, value, updated_at) VALUES (?, ?, CURRENT_TIMESTAMP)
              ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = CURRENT_TIMESTAMP
            `).bind(key, String(value)).run();
          }
          return jsonResponse({ success: true });
        }
      }
      if (path.startsWith("/api/settings/")) {
        const key = path.split("/").pop();
        if (method === "GET") {
          const row = await db.prepare("SELECT * FROM app_settings WHERE key = ?").bind(key).first();
          return jsonResponse(row ? { key: row.key, value: row.value } : { key, value: null });
        }
        if (method === "PUT") {
          const body = await request.json();
          const value = body.value !== void 0 ? String(body.value) : "";
          await db.prepare(`
            INSERT INTO app_settings (key, value, updated_at) VALUES (?, ?, CURRENT_TIMESTAMP)
            ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = CURRENT_TIMESTAMP
          `).bind(key, value).run();
          return jsonResponse({ success: true });
        }
      }
      return jsonResponse({ error: "Endpoint or Method not found" }, 404);
    } catch (err) {
      console.error("[SERVER ERROR]", { path, method, error: err.message });
      return jsonResponse({ error: err.message, path, method }, 500);
    }
  }
};

// ../../../../../../AppData/Roaming/npm/node_modules/wrangler/templates/middleware/middleware-ensure-req-body-drained.ts
var drainBody = /* @__PURE__ */ __name(async (request, env, _ctx, middlewareCtx) => {
  try {
    return await middlewareCtx.next(request, env);
  } finally {
    try {
      if (request.body !== null && !request.bodyUsed) {
        const reader = request.body.getReader();
        while (!(await reader.read()).done) {
        }
      }
    } catch (e) {
      console.error("Failed to drain the unused request body.", e);
    }
  }
}, "drainBody");
var middleware_ensure_req_body_drained_default = drainBody;

// ../../../../../../AppData/Roaming/npm/node_modules/wrangler/templates/middleware/middleware-miniflare3-json-error.ts
function reduceError(e) {
  return {
    name: e?.name,
    message: e?.message ?? String(e),
    stack: e?.stack,
    cause: e?.cause === void 0 ? void 0 : reduceError(e.cause)
  };
}
__name(reduceError, "reduceError");
var jsonError = /* @__PURE__ */ __name(async (request, env, _ctx, middlewareCtx) => {
  try {
    return await middlewareCtx.next(request, env);
  } catch (e) {
    const error = reduceError(e);
    return Response.json(error, {
      status: 500,
      headers: { "MF-Experimental-Error-Stack": "true" }
    });
  }
}, "jsonError");
var middleware_miniflare3_json_error_default = jsonError;

// .wrangler/tmp/bundle-n2lpko/middleware-insertion-facade.js
var __INTERNAL_WRANGLER_MIDDLEWARE__ = [
  middleware_ensure_req_body_drained_default,
  middleware_miniflare3_json_error_default
];
var middleware_insertion_facade_default = src_default;

// ../../../../../../AppData/Roaming/npm/node_modules/wrangler/templates/middleware/common.ts
var __facade_middleware__ = [];
function __facade_register__(...args) {
  __facade_middleware__.push(...args.flat());
}
__name(__facade_register__, "__facade_register__");
function __facade_invokeChain__(request, env, ctx, dispatch, middlewareChain) {
  const [head, ...tail] = middlewareChain;
  const middlewareCtx = {
    dispatch,
    next(newRequest, newEnv) {
      return __facade_invokeChain__(newRequest, newEnv, ctx, dispatch, tail);
    }
  };
  return head(request, env, ctx, middlewareCtx);
}
__name(__facade_invokeChain__, "__facade_invokeChain__");
function __facade_invoke__(request, env, ctx, dispatch, finalMiddleware) {
  return __facade_invokeChain__(request, env, ctx, dispatch, [
    ...__facade_middleware__,
    finalMiddleware
  ]);
}
__name(__facade_invoke__, "__facade_invoke__");

// .wrangler/tmp/bundle-n2lpko/middleware-loader.entry.ts
var __Facade_ScheduledController__ = class ___Facade_ScheduledController__ {
  constructor(scheduledTime, cron, noRetry) {
    this.scheduledTime = scheduledTime;
    this.cron = cron;
    this.#noRetry = noRetry;
  }
  static {
    __name(this, "__Facade_ScheduledController__");
  }
  #noRetry;
  noRetry() {
    if (!(this instanceof ___Facade_ScheduledController__)) {
      throw new TypeError("Illegal invocation");
    }
    this.#noRetry();
  }
};
function wrapExportedHandler(worker) {
  if (__INTERNAL_WRANGLER_MIDDLEWARE__ === void 0 || __INTERNAL_WRANGLER_MIDDLEWARE__.length === 0) {
    return worker;
  }
  for (const middleware of __INTERNAL_WRANGLER_MIDDLEWARE__) {
    __facade_register__(middleware);
  }
  const fetchDispatcher = /* @__PURE__ */ __name(function(request, env, ctx) {
    if (worker.fetch === void 0) {
      throw new Error("Handler does not export a fetch() function.");
    }
    return worker.fetch(request, env, ctx);
  }, "fetchDispatcher");
  return {
    ...worker,
    fetch(request, env, ctx) {
      const dispatcher = /* @__PURE__ */ __name(function(type, init) {
        if (type === "scheduled" && worker.scheduled !== void 0) {
          const controller = new __Facade_ScheduledController__(
            Date.now(),
            init.cron ?? "",
            () => {
            }
          );
          return worker.scheduled(controller, env, ctx);
        }
      }, "dispatcher");
      return __facade_invoke__(request, env, ctx, dispatcher, fetchDispatcher);
    }
  };
}
__name(wrapExportedHandler, "wrapExportedHandler");
function wrapWorkerEntrypoint(klass) {
  if (__INTERNAL_WRANGLER_MIDDLEWARE__ === void 0 || __INTERNAL_WRANGLER_MIDDLEWARE__.length === 0) {
    return klass;
  }
  for (const middleware of __INTERNAL_WRANGLER_MIDDLEWARE__) {
    __facade_register__(middleware);
  }
  return class extends klass {
    #fetchDispatcher = /* @__PURE__ */ __name((request, env, ctx) => {
      this.env = env;
      this.ctx = ctx;
      if (super.fetch === void 0) {
        throw new Error("Entrypoint class does not define a fetch() function.");
      }
      return super.fetch(request);
    }, "#fetchDispatcher");
    #dispatcher = /* @__PURE__ */ __name((type, init) => {
      if (type === "scheduled" && super.scheduled !== void 0) {
        const controller = new __Facade_ScheduledController__(
          Date.now(),
          init.cron ?? "",
          () => {
          }
        );
        return super.scheduled(controller);
      }
    }, "#dispatcher");
    fetch(request) {
      return __facade_invoke__(
        request,
        this.env,
        this.ctx,
        this.#dispatcher,
        this.#fetchDispatcher
      );
    }
  };
}
__name(wrapWorkerEntrypoint, "wrapWorkerEntrypoint");
var WRAPPED_ENTRY;
if (typeof middleware_insertion_facade_default === "object") {
  WRAPPED_ENTRY = wrapExportedHandler(middleware_insertion_facade_default);
} else if (typeof middleware_insertion_facade_default === "function") {
  WRAPPED_ENTRY = wrapWorkerEntrypoint(middleware_insertion_facade_default);
}
var middleware_loader_entry_default = WRAPPED_ENTRY;
export {
  __INTERNAL_WRANGLER_MIDDLEWARE__,
  middleware_loader_entry_default as default
};
//# sourceMappingURL=index.js.map
