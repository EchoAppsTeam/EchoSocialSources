(function($) {
"use strict";

if (Echo.AppServer.Dashboard.isDefined("Echo.Apps.SocialSources.Dashboard")) return;

var dashboard = Echo.AppServer.Dashboard.manifest("Echo.Apps.SocialSources.Dashboard");

dashboard.inherits = Echo.Utils.getComponent("Echo.AppServer.Dashboards.AppSettings");

dashboard.mappings = {
	"dependencies.appkey": {
		"key": "dependencies.StreamServer.appkey"
	},
	"presentation.nativeSegmentLabel": {
		"key": "sources.native.label"
	},

	"presentation.nativeSegmentColor": {
		"key": "sources.native.color"
	},
	"presentation.nativeSegmentHighlight": {
		"key": "sources.native.highlight"
	}
};

dashboard.dependencies = [{
	"url": "{config:cdnBaseURL.apps.appserver}/controls/configurator.js",
	"control": "Echo.AppServer.Controls.Configurator"
}, {
	"url": "{config:cdnBaseURL.apps.dataserver}/full.pack.js",
	"control": "Echo.DataServer.Controls.Pack"
}, {
	"url": "//cdn.echoenabled.com/apps/echo/social-map/v1/colorpicker.js"
}];

dashboard.config.ecl = [{
	"component": "Group",
	"name": "presentation",
	"type": "object",
	"config": {
		"title": "Presentation"
	},
	"items": [{
		"component": "Select",
		"name": "visualization",
		"type": "string",
		"default": "doughnut",
		"config": {
			"title": "Chart style",
			"desc": "Specifies the chart type to be used",
			"options": [{
				"title": "Doughnut Chart",
				"value": "doughnut"
			}, {
				"title": "Pie Chart",
				"value": "pie"
			}]
		}
	}, {
		"component": "Input",
		"name": "nativeSegmentLabel",
		"type": "string",
		"default": "Website",
		"config": {
			"title": "Native content label",
			"desc": "Specifies native content label to be displayed on the chart",
			"data": {"sample": "Comments"}
		}
	}, {
		"component": "Colorpicker",
		"name": "nativeSegmentColor",
		"type": "string",
		"default": "#D8D8D8",
		"config": {
			"title": "Native content color",
			"desc": "Specifies segment color for the native content section",
			"data": {"sample": "#D8D8D8"}
		}
	}, {
		"component": "Colorpicker",
		"name": "nativeSegmentHighlight",
		"type": "string",
		"default": "#E4E4E4",
		"config": {
			"title": "Native content highlight",
			"desc": "Specifies hover color for the native content segment",
			"data": {"sample": "#E4E4E4"}
		}
	}, {
		"component": "Input",
		"name": "maxWidth",
		"type": "number",
		"default": 500,
		"config": {
			"title": "Maximum width",
			"desc": "Specifies a maximum width (in pixels) of an App container",
			"data": {"sample": 500}
		}
	}]
}, {
	"component": "Group",
	"name": "dependencies",
	"type": "object",
	"config": {
		"title": "Dependencies",
		"expanded": false
	},
	"items": [{
		"component": "Select",
		"name": "appkey",
		"type": "string",
		"config": {
			"title": "StreamServer application key",
			"desc": "Specifies the application key for this instance",
			"options": []
		}
	}]
}, {
	"name": "targetURL",
	"component": "Echo.DataServer.Controls.Dashboard.DataSourceGroup",
	"type": "string",
	"required": true,
	"config": {
		"title": "",
		"expanded": false,
		"labels": {
			"dataserverBundleName": "Echo Social Source Auto-Generated Bundle for {instanceName}"
		},
		"apiBaseURLs": {
			"DataServer": "{%= apiBaseURLs.DataServer %}/"
		}
	}
}];

dashboard.modifiers = {
	"dependencies.appkey": {
		"endpoint": "customer/{self:user.getCustomerId}/appkeys",
		"processor": function() {
			return this.getAppkey.apply(this, arguments);
		}
	},
	"targetURL": {
		"endpoint": "customer/{self:user.getCustomerId}/subscriptions",
		"processor": function() {
			return this.getBundleTargetURL.apply(this, arguments);
		}
	}
};

dashboard.init = function() {
	this.parent();
};

dashboard.methods.declareInitialConfig = function() {
	return {
		"targetURL": this.assembleTargetURL(),
		"dependencies": {
			"StreamServer": {
				"appkey": this.getDefaultAppKey()
			}
		}
	};
};

Echo.AppServer.Dashboard.create(dashboard);

})(Echo.jQuery);
