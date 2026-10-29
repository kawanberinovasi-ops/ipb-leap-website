/*!
 * leap-runtime.js — runtime kecil untuk halaman publik IPB LEAP.
 * Membaca template halaman (sc-for, sc-if, dc-import, {{holes}}) dan
 * merender ulang dengan DOM patch ringan setiap kali state berubah.
 */
(function () {
  'use strict';

  var HOLE = /\{\{\s*([^}]+?)\s*\}\}/g;
  var ONLY_HOLE = /^\s*\{\{\s*([^}]+?)\s*\}\}\s*$/;

  function lookup(expr, scope) {
    expr = expr.trim();
    if (expr === 'true') return true;
    if (expr === 'false') return false;
    if (expr === 'null') return null;
    if (/^-?\d+(\.\d+)?$/.test(expr)) return Number(expr);
    var parts = expr.split('.');
    var v = scope;
    for (var i = 0; i < parts.length; i++) {
      if (v == null) return undefined;
      v = v[parts[i]];
    }
    return v;
  }

  function interp(str, scope) {
    return str.replace(HOLE, function (_, e) {
      var v = lookup(e, scope);
      return v == null ? '' : String(v);
    });
  }

  // ---------- DCLogic base class ----------
  function DCLogic(props) {
    this.props = props || {};
    this.state = {};
  }
  DCLogic.prototype.setState = function (patch) {
    var next = typeof patch === 'function' ? patch(this.state, this.props) : patch;
    if (!next) return;
    this.state = Object.assign({}, this.state, next);
    if (this.__inst) this.__inst.schedule();
  };
  DCLogic.prototype.renderVals = function () { return {}; };

  // ---------- component registry ----------
  var registry = {};
  function defineFromDom() {
    document.querySelectorAll('template[data-dc]').forEach(function (tpl) {
      var name = tpl.getAttribute('data-dc');
      var script = document.querySelector('script[type="text/x-dc"][data-dc="' + name + '"]');
      var Cls = DCLogic;
      var defaults = {};
      if (script) {
        try {
          // eslint-disable-next-line no-new-func
          Cls = new Function('DCLogic', script.textContent + '\n;return typeof Component !== "undefined" ? Component : DCLogic;')(DCLogic);
        } catch (err) { console.error('[leap] gagal memuat komponen ' + name, err); }
        try {
          var meta = JSON.parse(script.getAttribute('data-props') || '{}');
          Object.keys(meta).forEach(function (k) {
            if (k.charAt(0) !== '$' && meta[k] && 'default' in meta[k]) defaults[k] = meta[k].default;
          });
        } catch (e) { /* abaikan */ }
      }
      registry[name] = { tpl: tpl, Cls: Cls, defaults: defaults };
    });
  }

  // ---------- instance ----------
  function Instance(name, props, host) {
    var def = registry[name];
    if (!def) throw new Error('Komponen tidak ditemukan: ' + name);
    this.def = def;
    this.host = host;
    this.children = [];
    this.props = Object.assign({}, def.defaults, props);
    this.comp = new def.Cls(this.props);
    this.comp.props = this.props;
    if (!this.comp.state) this.comp.state = {};
    this.comp.__inst = this;
    this.pending = false;
  }
  Instance.prototype.schedule = function () {
    var self = this;
    if (self.pending) return;
    self.pending = true;
    (window.requestAnimationFrame || setTimeout)(function () { self.pending = false; self.render(); });
  };
  Instance.prototype.setProps = function (props) {
    var merged = Object.assign({}, this.def.defaults, props);
    var changed = Object.keys(merged).some(function (k) { return merged[k] !== this.props[k]; }, this);
    if (!changed) return;
    this.props = merged;
    this.comp.props = merged;
    this.render();
  };
  Instance.prototype.render = function () {
    var vals;
    try { vals = this.comp.renderVals() || {}; } catch (err) { console.error('[leap] renderVals error', err); return; }
    var scope = Object.assign({}, this.props, vals);
    this.importIdx = 0;
    var frag = document.createDocumentFragment();
    renderChildren(this.def.tpl.content, scope, this, frag);
    patchChildren(this.host, frag);
    if (!this.mounted) {
      this.mounted = true;
      if (typeof this.comp.componentDidMount === 'function') {
        try { this.comp.componentDidMount(); } catch (err) { console.error(err); }
      }
    }
  };

  // ---------- template → fresh DOM ----------
  function renderChildren(parentTpl, scope, inst, out) {
    var n = parentTpl.firstChild;
    while (n) { renderNode(n, scope, inst, out); n = n.nextSibling; }
  }

  function renderNode(node, scope, inst, out) {
    if (node.nodeType === 3) {
      out.appendChild(document.createTextNode(interp(node.data, scope)));
      return;
    }
    if (node.nodeType !== 1) return;
    var tag = node.localName;
    if (tag === 'sc-for') {
      var listExpr = (node.getAttribute('list') || '').match(ONLY_HOLE);
      var list = listExpr ? lookup(listExpr[1], scope) : null;
      var as = node.getAttribute('as') || 'item';
      if (Array.isArray(list)) {
        list.forEach(function (item, i) {
          var s = Object.create(scope);
          s[as] = item; s.$index = i;
          renderChildren(node, s, inst, out);
        });
      }
      return;
    }
    if (tag === 'sc-if') {
      var vExpr = (node.getAttribute('value') || '').match(ONLY_HOLE);
      var ok = vExpr ? lookup(vExpr[1], scope) : false;
      if (ok) renderChildren(node, scope, inst, out);
      return;
    }
    if (tag === 'dc-import') {
      var name = node.getAttribute('name');
      var props = {};
      Array.prototype.forEach.call(node.attributes, function (a) {
        if (a.name === 'name' || a.name.indexOf('hint-') === 0) return;
        var m = a.value.match(ONLY_HOLE);
        props[a.name] = m ? lookup(m[1], scope) : interp(a.value, scope);
      });
      var host = document.createElement('div');
      host.setAttribute('data-dc-host', name);
      host.__dcImport = { name: name, props: props, key: inst.importIdx++, parent: inst };
      out.appendChild(host);
      return;
    }
    var el = node.namespaceURI && node.namespaceURI !== 'http://www.w3.org/1999/xhtml'
      ? document.createElementNS(node.namespaceURI, node.tagName)
      : document.createElement(tag);
    Array.prototype.forEach.call(node.attributes, function (a) {
      var an = a.name;
      if (an.indexOf('hint-') === 0) return;
      if (/^on[a-z]+$/.test(an)) {
        var hm = a.value.match(ONLY_HOLE);
        var fn = hm ? lookup(hm[1], scope) : null;
        if (typeof fn === 'function') {
          var ev = an.slice(2);
          // onChange ala React: untuk input teks/textarea dipicu setiap ketikan
          if (ev === 'change' && (tag === 'textarea' || (tag === 'input' && !/^(checkbox|radio|file|range|color|date|time|month|week|datetime-local)$/i.test(node.getAttribute('type') || '')))) ev = 'input';
          el.__dcH = el.__dcH || {};
          el.__dcH[ev] = fn;
        }
        return;
      }
      if (a.value.indexOf('{{') !== -1) el.setAttribute(an, interp(a.value, scope));
      else el.setAttribute(an, a.value);
    });
    var src = node.localName === 'template' ? node.content : node;
    renderChildren(src, scope, inst, el);
    out.appendChild(el);
  }

  // ---------- patching ----------
  function dispatcher(e) {
    var h = this.__dcH && this.__dcH[e.type];
    if (h) h.call(this, e);
  }
  function syncHandlers(target, src) {
    var oldH = target.__dcH || {};
    var newH = src.__dcH || {};
    Object.keys(newH).forEach(function (t) { if (!oldH[t]) target.addEventListener(t, dispatcher); });
    target.__dcH = newH;
  }

  function sameKind(a, b) {
    return a.nodeType === b.nodeType && a.nodeName === b.nodeName &&
      (a.nodeType !== 1 || a.getAttribute('data-dc-host') === b.getAttribute('data-dc-host'));
  }

  function patchAttrs(target, src) {
    var i, a;
    for (i = target.attributes.length - 1; i >= 0; i--) {
      a = target.attributes[i];
      if (!src.hasAttribute(a.name)) target.removeAttribute(a.name);
    }
    for (i = 0; i < src.attributes.length; i++) {
      a = src.attributes[i];
      if (target.getAttribute(a.name) !== a.value) {
        target.setAttribute(a.name, a.value);
        if (a.name === 'value' && 'value' in target) target.value = a.value;
      }
    }
    // properti form mengikuti atribut saat atribut berubah
    ['checked', 'selected'].forEach(function (p) {
      var has = src.hasAttribute(p);
      if (p in target && target.__dcLast && target.__dcLast[p] !== has) target[p] = has;
      target.__dcLast = target.__dcLast || {};
      target.__dcLast[p] = has;
    });
  }

  function mountImport(host, info) {
    var inst = new Instance(info.name, info.props, host);
    host.__dcInst = inst;
    info.parent.children.push(inst);
    inst.render();
  }

  function patchNode(target, src) {
    if (target.nodeType === 3) {
      if (target.data !== src.data) target.data = src.data;
      return;
    }
    if (src.__dcImport) {
      if (target.__dcInst) target.__dcInst.setProps(src.__dcImport.props);
      else mountImport(target, src.__dcImport);
      return;
    }
    patchAttrs(target, src);
    syncHandlers(target, src);
    if (target.nodeName === 'TEXTAREA') {
      var before = target.textContent;
      patchChildren(target, src);
      if (target.textContent !== before) target.value = target.textContent;
      return;
    }
    patchChildren(target, src);
  }

  function patchChildren(target, src) {
    var srcKids = Array.prototype.slice.call(src.childNodes);
    var i = 0;
    for (; i < srcKids.length; i++) {
      var s = srcKids[i];
      var t = target.childNodes[i];
      if (t && sameKind(t, s)) {
        patchNode(t, s);
      } else {
        var fresh = materialize(s);
        if (t) target.replaceChild(fresh, t); else target.appendChild(fresh);
      }
    }
    while (target.childNodes.length > srcKids.length) target.removeChild(target.lastChild);
  }

  // turn a freshly rendered node (possibly containing import hosts) into a live node
  function materialize(node) {
    if (node.nodeType === 1) {
      if (node.__dcImport) {
        var info = node.__dcImport;
        delete node.__dcImport;
        mountImport(node, info);
        return node;
      }
      if (node.__dcH) Object.keys(node.__dcH).forEach(function (t) { node.addEventListener(t, dispatcher); });
      Array.prototype.slice.call(node.childNodes).forEach(function (c) {
        var m = materialize(c);
        if (m !== c) node.replaceChild(m, c);
      });
    }
    return node;
  }

  // ---------- boot ----------
  function boot() {
    defineFromDom();
    var root = document.getElementById('app');
    var page = root && root.getAttribute('data-page');
    if (!page) return;
    var inst = new Instance(page, {}, root);
    window.__leapRoot = inst;
    inst.render();
  }

  window.DCLogic = DCLogic;
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
