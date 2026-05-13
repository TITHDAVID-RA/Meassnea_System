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
      // Replace with your production domain if needed
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
    try {
      const db = env.meassnea_db;
      if (!db) {
        return jsonResponse({ error: "Database binding 'meassnea_db' not found." }, 500);
      }
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
          `).bind(id, material_id, material_name, size || "N/A", quantity, unit_price, total_price, type, notes).run();
          return jsonResponse({ success: true, id }, 201);
        }
      }
      if (path === "/api/orders") {
        if (method === "GET") {
          const { results: orders } = await db.prepare("SELECT * FROM orders ORDER BY order_date DESC").all();
          const { results: items } = await db.prepare("SELECT * FROM order_items").all();
          const ordersWithItems = orders.map((order) => ({
            ...order,
            items: items.filter((item) => item.order_id === order.id)
          }));
          return jsonResponse(ordersWithItems);
        }
        if (method === "POST") {
          const body = await request.json();
          const { id, order_number, customer, total, delivery_cost, plastic_bag_qty, case_box_qty, payment_method, status, order_date, items } = body;
          const statements = [
            db.prepare(`
              INSERT INTO orders (id, order_number, customer, total, delivery_cost, plastic_bag_qty, case_box_qty, payment_method, status, order_date)
              VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            `).bind(id, order_number, customer, total, delivery_cost || 0, plastic_bag_qty || 0, case_box_qty || 0, payment_method || "cash", status || "pending", order_date || (/* @__PURE__ */ new Date()).toISOString())
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
          const { id, order_id, amount, category, payment_method, description, customer, reference, income_date } = body;
          await db.prepare(`
            INSERT INTO incomes (id, order_id, amount, category, payment_method, description, customer, reference, income_date)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
          `).bind(id, order_id, amount, category, payment_method, description, customer, reference, income_date).run();
          return jsonResponse({ success: true, id }, 201);
        }
      }
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
          `).bind(id, name, category, location, assigned_to, vendor, value, description, purchase_date, status || "active").run();
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
          `).bind(id, vendor, total || 0, status || "pending", JSON.stringify(items), notes).run();
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
      if (path === "/api/categories") {
        if (method === "GET") {
          const { results } = await db.prepare("SELECT * FROM categories").all();
          return jsonResponse(results);
        }
      }
      return jsonResponse({ error: "Endpoint or Method not found" }, 404);
    } catch (err) {
      return jsonResponse({ error: err.message }, 500);
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

// .wrangler/tmp/bundle-lHxIsZ/middleware-insertion-facade.js
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

// .wrangler/tmp/bundle-lHxIsZ/middleware-loader.entry.ts
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
