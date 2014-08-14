(function($) {
"use strict";

var sources = Echo.App.manifest("Echo.Apps.SocialSources");

if (Echo.App.isDefined(sources)) return;

sources.vars = {
	"chart": undefined,
	"sources": []
};

sources.config = {
	"targetURL": undefined,
	// amount of items to retrieve from StreamServer
	// 100 is the limitation on the amount of root items
	"maxItemsToRetrieve": 100,
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
		"maxWidth": 500 // in px
	},
	"chart": {
		"tooltipTemplate": "<%=label%>",
		"responsive": true
	},
	"dependencies": {
		"StreamServer": {
			"appkey": undefined,
			"apiBaseURL": "{%= apiBaseURLs.StreamServer.basic %}",
			"liveUpdates": {
				"transport": "websockets",
				"enabled": true,
				"websockets": {
					"URL": "{%= apiBaseURLs.StreamServer.ws %}"
				}
			}
		}
	}
};

sources.labels = {
        "noSources": "There are no items yet.<br>Stay tuned!"
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

	app._requestData({
		"onData": function(data) {
			app._associateWithSources(data.entries);
			app.render();

			// we init graph *only* after a target is placed into DOM,
			// Chart.js doesn't like elements detached from DOM structure...
			if (app.get("sources").length) {
				app.set("chart", app._initChart(app.view.get("graph")));
			}

			app.ready();
		},
		"onUpdate": function(data) {
			var chartInitialized = !!app.get("chart");
			app._associateWithSources(data.entries, chartInitialized);
			if (app.get("sources").length && !chartInitialized) {
				// rerender the whole app
				// to switch templates and init chart
				app.render();
				app.set("chart", app._initChart(app.view.get("graph")));
			}
		},
		"onError": function(data, options) {
			var isCriticalError =
				typeof options.critical === "undefined" ||
				options.critical && options.requestType === "initial";

			if (isCriticalError) {
				app.showError(data, $.extend(options, {
					"request": app.request
				}));
			}
		}
	});
};

sources.methods.template = function() {
	return this.templates[this.get("sources").length ? "graph" : "empty"];
};

sources.templates.graph =
	'<div class="{class:container}">' +
		'<canvas class="{class:graph}"></canvas>' +
	'</div>';

sources.templates.empty =
	'<div class="{class:empty}">' +
		'<span class="{class:message}">{label:noSources}</span>' +
	'</div>';

sources.renderers.container = function(element) {
	return element.css({
		"max-width": parseInt(this.config.get("presentation.maxWidth") + "px")
	});
};

sources.methods._initChart = function(target) {
	var ctx = target.get(0).getContext("2d");
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
					chart.update();
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

sources.methods._requestData = function(handlers) {
	var ssConfig = this.config.get("dependencies.StreamServer");
	// keep a reference to a request object in "this" to trigger its
	// automatic sweeping out on Echo.Control level at app destory time
	this.request = Echo.StreamServer.API.request({
		"endpoint": "search",
		"apiBaseURL": ssConfig.apiBaseURL,
		"data": {
			"q": this._assembleQuery(),
			"appkey": ssConfig.appkey
		},
		"liveUpdates": $.extend(ssConfig.liveUpdates, {
			"onData": handlers.onUpdate
		}),
		"onError": handlers.onError,
		"onData": handlers.onData
	});
	this.request.send();
};

sources.css =
        '.{class:empty} { border: 1px solid #d2d2d2; margin: 0 5px 10px 5px; padding: 30px 0; text-align: left; }' +
        '.{class:empty} .{class:message} { background: url("//cdn.echoenabled.com/apps/echo/conversations/v2/sdk-derived/images/info.png") no-repeat; margin: 0 auto; font-size: 14px; font-family: "Helvetica Neue", Helvetica, "Open Sans", sans-serif; padding-left: 40px; display: block; width: 180px; line-height: 16px; color: #7f7f7f; }' +
	'.{class:container} { margin: 0px auto; }' +
	'.{class:graph} { width: 100%; }';

Echo.App.create(sources);

})(Echo.jQuery);
