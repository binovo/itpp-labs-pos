/*  Copyright 2014-2017 Ivan Yelizariev <https://it-projects.info/team/yelizariev>
    Copyright 2016 gaelTorrecillas <https://github.com/gaelTorrecillas>
    Copyright 2016 manawi <https://github.com/manawi>
    Copyright 2017 Ilmir Karamov <https://it-projects.info/team/ilmir-k>
    Copyright 2018,2019 Kolushov Alexandr <https://it-projects.info/team/KolushovAlexandr>
    License MIT (https://opensource.org/licenses/MIT). */
odoo.define("pos_product_available.PosModel", function(require) {
    "use strict";

    var rpc = require("web.rpc");
    var models = require("point_of_sale.models");
    var field_utils = require("web.field_utils");

    models.load_fields('product.product', ['qty_available', 'type']);

    var PosModelSuper = models.PosModel.prototype;
    models.PosModel = models.PosModel.extend({
        set_product_qty_available: function(product, qty) {
            product.qty_available = qty;
            this.refresh_qty_available(product);
        },
        update_product_qty_from_order_lines: function(order) {
            var self = this;
            order.orderlines.each(function(line) {
                var product = line.get_product();
                product.qty_available = Math.round(
                    product.qty_available - line.get_quantity(),
                    {digits: [69, 3]}
                );
                self.refresh_qty_available(product);
            });
            // Compatibility with pos_multi_session
            order.trigger("new_updates_to_send");
        },
        refresh_qty_available: function(product) {
            var $elem = $("[data-product-id='" + product.id + "'] .qty-tag");
            $elem.html(product.rounded_qty());
            if (product.qty_available <= 0 && !$elem.hasClass("not-available")) {
                $elem.addClass("not-available");
            }
        },
        push_order: function(order, opts) {
            var pushed = PosModelSuper.push_order.call(this, order, opts);
            if (order) {
                this.update_product_qty_from_order_lines(order);
            }
            return pushed;
        },
        push_and_invoice_order: function(order) {
            var invoiced = PosModelSuper.push_and_invoice_order.call(this, order);

            if (order && order.get_client() && order.orderlines) {
                this.update_product_qty_from_order_lines(order);
            }

            return invoiced;
        },
    });

    var OrderlineSuper = models.Orderline;
    models.Orderline = models.Orderline.extend({
        // Compatibility with pos_multi_session
        apply_ms_data: function(data) {
            if (OrderlineSuper.prototype.apply_ms_data) {
                OrderlineSuper.prototype.apply_ms_data.apply(this, arguments);
            }
            var product = this.pos.db.get_product_by_id(data.product_id);
            if (product.qty_available !== data.qty_available) {
                this.pos.set_product_qty_available(product, data.qty_available);
            }
        },
    });

    models.Product = models.Product.extend({
        /*
        Commented this code, cause it works incorrect
        Example: "this.format_float_value(2366) === 2"
        rounded_qty: function() {
            return this.format_float_value(this.qty_available);
        },
        */
        rounded_qty: function() {
            return Math.round(this.qty_available);
        },
    });
});
