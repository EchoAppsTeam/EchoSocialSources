(function($) {
"use strict";

var sources = Echo.App.manifest("Echo.Apps.SocialSources");

if (Echo.App.isDefined(sources)) return;

sources.vars = {
	"chart": undefined,
	"sources": [],
	"visible": true,
	"watchers": {}
};

sources.config = {
	"targetURL": undefined,
	// amount of items to retrieve from StreamServer
	// 100 is the limitation on the amount of root items
	"maxItemsToRetrieve": 100,
	"chartUpdateDelay": 10000, // in ms
	"sources": {
		"twitter": {
			"id": "twitter",
			"color": "#00ACEA",
			"highlight": "#4CC5F1",
			"label": "Twitter"
		},
		"instagram": {
			"id": "instagram",
			"color": "#346A91",
			"highlight": "#7197B2",
			"label": "Instagram"
		},
		"facebook": {
			"id": "facebook",
			"color": "#3D5995",
			"highlight": "#778BB5",
			"label": "Facebook"
		},
		"youtube": {
			"id": "youtube",
			"color": "#FF0019",
			"highlight": "#FF4C5E",
			"label": "Youtube"
		},
		"native": {
			"id": "native",
			"color": "#D8D8D8",
			"highlight": "#E4E4E4",
			"label": "Website"
		},
		"other": {
			"id": "other",
			"color": "#EF4836",
			"highlight": "#F47F72",
			"label": "Other"
		}
	},
	"presentation": {
		"visualization": "doughnut", // or "pie"
		"maxWidth": 220 // in px
	},
	"chart": {
		"tooltipTemplate": "<%=label%>",
		"responsive": true,
		"segmentStrokeWidth": 1
	},
	"dependencies": {
		"StreamServer": {
			"appkey": undefined,
			"apiBaseURL": "{%= apiBaseURLs.StreamServer.basic %}/",
			"liveUpdates": {
				"transport": "websockets",
				"enabled": true,
				"websockets": {
					"URL": "{%= apiBaseURLs.StreamServer.ws %}/"
				}
			}
		}
	}
};

sources.labels = {
	"noSources": "No data yet.<br>Stay tuned!"
};

sources.dependencies = [{
	"url": "{config:cdnBaseURL.sdk}/api.pack.js",
	"control": "Echo.StreamServer.API"
}, {
	"url": "{%= appBaseURLs.prod %}/third-party/chart.min.js",
	"loaded": function() { return !!window.Chart; }
}];

sources.init = function() {
	var app = this;

	// check for "targetURL" field, without
	// this field we are unable to retrieve any data
	if (!this.config.get("targetURL")) {
		this.showMessage({
			"type": "error",
			"message": "Unable to retrieve data, target URL is not specified."
		});
		return;
	}

	// spin up document visibility watcher to stop
	// gauge rendering in case a page is not active
	var watcher = app._createDocumentVisibilityWatcher();
	if (watcher) {
		watcher.start(function() {
			app.set("visible", true);
			app.refresh();
		}, function() {
			app.set("visible", false);
		});
		app.set("watchers.visibility", watcher);
	}

	// create chart update watcher to prevent
	// massive amount of chart update calls
	app.set("watchers.update", app._createUpdateWatcher());

	app.request = app._getRequestObject();

	var data = app.get("data");
	if ($.isEmptyObject(data)) {
		app.request.send();
	} else {
		app._getHandlerFor("onData")(data);
		app.request.send({
			"skipInitialRequest": true,
			"data": {
				"q": app._assembleQuery(),
				"appkey": app.config.get("dependencies.StreamServer.appkey"),
				"since": data.nextSince
			}
		});
	}
};

sources.destroy = function() {
	$.each(this.get("watchers"), function(_, watcher) {
		watcher.stop();
	});
};

sources.methods.template = function() {
	return this.templates[this.get("sources").length ? "graph" : "empty"];
};

sources.templates.graph =
	'<div class="{class:container}">' +
		'<div class="{class:subcontainer}">' +
			'<canvas class="{class:graph}"></canvas>' +
		'</div>' +
	'</div>';

sources.templates.empty =
	'<div class="{class:empty}">' +
		'<span class="{class:message}">{label:noSources}</span>' +
	'</div>';

sources.methods._initChart = function(target) {
	var ctx = target.get(0).getContext("2d");
	var width = Math.min(
			parseInt(target.width()),
			parseInt(this.config.get("presentation.maxWidth")));

	// we want target to be square at all times
	if (ctx.canvas && width) {
		ctx.canvas.width = width;
		ctx.canvas.height = width;
	}

	var type = this.config.get("presentation.visualization") === "pie"
		? "Pie"
		: "Doughnut";
	return new Chart(ctx)[type](this.get("sources"), this.config.get("chart"));
};

sources.methods._associateWithSources = function(entries, updateChart) {
	if (!entries || !entries.length) return;
	var app = this;
	var chart = this.get("chart");
	var configs = this.config.get("sources");
	var sources = this.get("sources", []);
	$.map(entries, function(entry) {
		if (entry.verbs[0] !== "http://activitystrea.ms/schema/1.0/post") return;
		var placed = false;
		var itemSource = app._classifySource(entry);
		$.each(sources, function(id, source) {
			if (source.id === itemSource) {
				source.value++;
				if (updateChart && chart.segments[id]) {
					chart.segments[id].value = source.value;
					app.get("watchers.update").start();
				}
				placed = true;
				return false; // break
			}
		});
		if (!placed) {
			var newSource = $.extend({"value": 1}, configs[itemSource]);
			sources.push(newSource);
			if (updateChart) {
				chart.addData(newSource);
			}
		}
	});
};

sources.methods._classifySource = function(entry) {
	var source = entry.source.name.toLowerCase();
	var configs = this.config.get("sources");
	if (!this.get("customerId")) {
		var canvasId = this.config.get("canvasId");
		this.set("customerId", canvasId.split("/")[0].toLowerCase());
	}
	return configs[source]
		? source
		: this.get("customerId") === source ? "native" : "other";
};

sources.methods._assembleQuery = function() {
	var query = "childrenof:{config:targetURL} " +
		"itemsPerPage:{config:maxItemsToRetrieve} children:0";
	return this.substitute({"template": query});
};

sources.methods._getRequestObject = function() {
	var ssConfig = this.config.get("dependencies.StreamServer");
	return Echo.StreamServer.API.request({
		"endpoint": "search",
		"apiBaseURL": ssConfig.apiBaseURL,
		"data": {
			"q": this._assembleQuery(),
			"appkey": ssConfig.appkey
		},
		"liveUpdates": $.extend(ssConfig.liveUpdates, {
			"onData": this._getHandlerFor("onUpdate")
		}),
		"onError": this._getHandlerFor("onError"),
		"onData": this._getHandlerFor("onData")
	});
};

// we prevent chart updates from super-fast calls in case of a huge
// new items flow, since chart update is quite CPU-intensive operation.
sources.methods._createUpdateWatcher = function() {
	var app = this, timeout;
	var stop = function() {
		clearTimeout(timeout);
		timeout = undefined;
	};
	var start = function() {
		if (timeout || !app.get("chart")) return;
		timeout = setTimeout(function() {
			if (app.get("visible")) {
				app.get("chart").update();
			}
			stop();
		}, app.config.get("chartUpdateDelay"));
	};
	return {"start": start, "stop": stop};
};

// maybe move to Echo.Utils later...
// note: the same function is located within Echo Historical Volume app!
// inspired by http://www.html5rocks.com/en/tutorials/pagevisibility/intro/
sources.methods._createDocumentVisibilityWatcher = function() {
	var prefix, handler;

	// if "hidden" is natively supported just return it
	if ("hidden" in document) {
		prefix = ""; // non-prefixed, i.e. natively supported
	} else {
		var prefixes = ["webkit", "moz", "ms", "o"];
		for (var i = 0; i < prefixes.length; i++) {
			if ((prefixes[i] + "Hidden") in document) {
				prefix = prefixes[i] + "Hidden";
				break;
			}
		}
	}

	// we were unable to locate "hidden" property,
	// which means this functionality is not supported
	if (prefix === undefined) return;

	var eventName = prefix + "visibilitychange";
	return {
		"start": function(onShow, onHide) {
			handler = function() {
				document[prefix ? prefix + "Hidden" : "hidden"]
					? onHide()
					: onShow();
			};
			$(document).on(eventName, handler);
		},
		"stop": function() {
			$(document).off(eventName, handler);
		}
	};
};

sources.methods._getHandlerFor = function(name) {
	return $.proxy(this.handlers[name], this);
};

sources.methods.handlers = {};

sources.methods.handlers.onData = function(data) {
	var app = this;

	// store initial data in the config as well,
	// so that we can access it later to refresh the gauge
	if ($.isEmptyObject(app.config.get("data"))) {
		app.config.set("data", data);
	}

	app._associateWithSources(data.entries);
	app.render();

	// we init graph *only* after a target is placed into DOM,
	// Chart.js doesn't like elements detached from DOM structure...
	if (app.get("sources").length) {
		app.set("chart", app._initChart(app.view.get("graph")));
	}

	app.ready();
};

sources.methods.handlers.onUpdate = function(data) {
	if (!data || !data.entries) return;

	if (this.get("visible")) {
		var chartInitialized = !!this.get("chart");
		this._associateWithSources(data.entries, chartInitialized);
		if (this.get("sources").length && !chartInitialized) {
			// rerender the whole app
			// to switch templates and init chart
			this.render();
			this.set("chart", this._initChart(this.view.get("graph")));
		}
	}

	if (data && data.entries) {
		var max = this.config.get("maxItemsToRetrieve");
		var entries = this.config.get("data.entries", []);
		data.entries = data.entries.concat(entries).slice(0, max);
		this.config.set("data", data);
	}
};

sources.methods.handlers.onError = function(data, options) {
	var isCriticalError =
		typeof options.critical === "undefined" ||
		options.critical && options.requestType === "initial";

	if (isCriticalError) {
		this.showError(data, $.extend(options, {
			"request": this.request
		}));
	}
};

sources.css =
	'.{class:empty} { border: 1px solid #d2d2d2; background-color: #fff; margin: 0px; margin-bottom: 10px; padding: 30px 20px; text-align: center; }' +
	'.{class:empty} .{class:message} { background: url("//cdn.echoenabled.com/apps/echo/conversations/v2/sdk-derived/images/info.png") no-repeat; margin: 0 auto; font-size: 14px; font-family: "Helvetica Neue", Helvetica, "Open Sans", sans-serif; padding-left: 40px; display: inline-block; text-align: left; line-height: 16px; color: #7f7f7f; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 100%; box-sizing: border-box; }' +
	'.{class:container} { margin: 0px auto; }' +
	'.{class:subcontainer} { margin: 10px 25px; }' +
	'@media (max-width: 768px) { .{class:subcontainer} { margin: 5px 5px; } }' +
	'.{class:graph} { width: 100%; }';

Echo.App.create(sources);

})(Echo.jQuery);
