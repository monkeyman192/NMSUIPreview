String.prototype.format = function () {
	return [...arguments].reduce((p, c) => p.replace(/%s/, c), this);
};

function readSingleFile(e) {
	const file = e.files.item(0);
	if (!file) return;

	var reader = new FileReader();
	reader.onload = function (e) {
		var contents = e.target.result;
		// Display file content
		drawUI(contents);
	};
	reader.readAsText(file);
}

function drawUI(contents) {
	// Load the XML document
	parser = new DOMParser();
	xmlDoc = parser.parseFromString(contents, "text/xml");
	// Get the main template
	var template = xmlDoc.getElementsByTagName("Data")[0];
	// clear the canvas
	var canvas = document.getElementById("drawingCanvas");
	var ctx = canvas.getContext("2d");
	ctx.clearRect(0, 0, canvas.width, canvas.height);
	// Clear the file structure
	clearList();
	// Find the list of things
	var names_list = new Object();
	// Load the main template
	readNGuiLayerData(template, null, names_list);
	var list = document.createElement('ul');
	document.getElementById("file-structure").appendChild(populateList(list, names_list));
}

// Currently unused. This was for debugging
function printInfo(content) {
	// Get the current 
	var element = document.getElementById('file-content');
	element.innerHTML += content;
}

function childElements(element) {
	// return an array of child elements
	return Array.from(element.children);
}

function populateList(list, data) {
	// Populate the list of nodes
	var item = document.createElement('li');
	item.appendChild(document.createTextNode("Node name: " + data["ID"]));
	list.appendChild(item);
	if (data["children"] != null) {
		var child_list = document.createElement('ul');
		for (var child of data["children"]) {
			populateList(child_list, child);
		}
		list.appendChild(child_list);
	}
	return list
}

function clearList() {
	document.getElementById("file-structure").innerHTML = '';
}

function readNGuiLayerData(element, parentElementData = null, name_list = null) {
	// Reads an NGuiLayerData struct
	var style = elementByName(element, "Style");
	var style_dict = new Object();
	readNGuiGraphicStyle(style, style_dict);
	if (elementByName(element, "ElementData").querySelector('[name="IsHidden"]').getAttribute("value") == "True") return;
	var elementData = readNGuiElementData(elementByName(element, "ElementData"),
		style_dict, parentElementData, name_list);
	var children_nodes = childElements(elementByName(element, "Children"));
	var child_list = [];
	for (var child of children_nodes) {
		var child_obj = new Object();
		switch (child.getAttribute("value")) {
			case "GcNGuiLayerData.xml":
				readNGuiLayerData(child, elementData, child_obj);
				break;

			case "GcNGuiGraphicData.xml":
				readNGuiGraphicData(child, elementData, child_obj);
				break;

			case "GcNGuiTextData.xml":
				readNGuiTextData(child, elementData, child_obj);
				break;
		}
		child_list.push(child_obj);
	}
	name_list["children"] = child_list;
}

// children functions

function readNGuiGraphicData(element, parentElementData, name_list) {
	// Reads an NGUILayerData struct
	var style_dict = new Object();
	readNGuiGraphicStyle(elementByName(element, "Style"), style_dict)
	elementData = readNGuiElementData(elementByName(element, "ElementData"),
		style_dict, parentElementData, name_list);
}

function readNGuiTextData(element, parentElementData, name_list) {
	var text = elementByName(element, "Text").getAttribute("value");
	var style_dict = new Object();
	readNGuiGraphicStyle(elementByName(element, "GraphicStyle"), style_dict);
	var text_style_dict = Object();
	readNGuiTextStyle(elementByName(element, "Style"), text_style_dict)
	var elementData = readNGuiElementData(elementByName(element, "ElementData"),
		style_dict, parentElementData, name_list);
	// draw the text
	var defaultStyle = text_style_dict["Default"];
	var canvas = document.getElementById("drawingCanvas");
	var ctx = canvas.getContext("2d");
	// Save the context so we can restore to it.
	ctx.save();
	ctx.font = "%spx Ariel".format(defaultStyle["FontHeight"]);
	ctx.fillStyle = colourToRGBA(defaultStyle["Colour"]);
	if (defaultStyle["HasDropShadow"] == "True") {
		ctx.shadowColor = colourToRGBA(defaultStyle["ShadowColour"]);
		ctx.shadowOffsetX = defaultStyle["DropShadowOffset"] * Math.cos(defaultStyle["DropShadowAngle"]);
		ctx.shadowOffsetY = defaultStyle["DropShadowOffset"] * Math.sin(defaultStyle["DropShadowAngle"]);
		ctx.shadowBlur = 3;		// Arbitrary value to make it look nicer
	}
	ctx.fillText(text, elementData[0] + style_dict["Default"]["PaddingX"], elementData[1] + defaultStyle["FontHeight"] + style_dict["Default"]["PaddingY"]);
	ctx.restore();
}

// other stuff

function readNGuiElementData(element, style, parentElementData, name_list) {
	var ID = elementByName(element, "ID").getAttribute("value");
	name_list["ID"] = ID
	// Return the layout data as the sizes are needed for child templates to
	// determine their actual position/size.
	return readNGuiLayoutData(elementByName(element, "Layout"), style,
		parentElementData);
}

function readNGuiLayoutData(element, style, parentElementData) {
	var PositionX = parseInt(elementByName(element, "PositionX").getAttribute("value"));
	var PositionY = parseInt(elementByName(element, "PositionY").getAttribute("value"));
	var Width = parseInt(elementByName(element, "Width").getAttribute("value"));
	var WidthPercentage = elementByName(element, "WidthPercentage").getAttribute("value");
	var Height = parseInt(elementByName(element, "Height").getAttribute("value"));
	var HeightPercentage = elementByName(element, "HeightPercentage").getAttribute("value");

	// determine the proportions of the parent element data.
	// If there is no parent then the parentElementData will be null.
	// Otherwise it will be a list of 4 values equivalent to that returned by
	// this function.
	if (parentElementData) {
		parentOffsetX = parentElementData[0];
		parentOffsetY = parentElementData[1];
		parentWidth = parentElementData[2];
		parentHeight = parentElementData[3];
	} else {
		var canvas = document.getElementById("drawingCanvas");
		parentOffsetX = 0;
		parentOffsetY = 0;
		parentWidth = canvas.width;
		parentHeight = canvas.height;
	}

	// make the offsets relative to the parent
	PositionX = parentOffsetX + PositionX;
	PositionY = parentOffsetY + PositionY;

	// Check to see if the width/height are relative
	if (WidthPercentage == "True") {
		Width = parentWidth * (Width / 100);
	}
	if (HeightPercentage == "True") {
		Height = parentHeight * (Height / 100);
	}
	drawRectangle(PositionX, PositionY, Width, Height, style);
	return [PositionX, PositionY, Width, Height];
}

// style reading functions

function readNGuiTextStyle(element, style_dict) {
	// Main entry point for loading text style data into the style dict.
	// create style objects for each situation
	var defaultStyle = new Object();
	var highlightStyle = new Object();
	var activeStyle = new Object();
	// populate the dictionaries
	readNGuiTextStyleData(elementByName(element, "Default"), defaultStyle);
	readNGuiTextStyleData(elementByName(element, "Highlight"), highlightStyle);
	readNGuiTextStyleData(elementByName(element, "Active"), activeStyle);
	// combine them all
	style_dict['Default'] = defaultStyle;
	style_dict['Highlight'] = highlightStyle;
	style_dict['Active'] = activeStyle;
}

function readNGuiTextStyleData(element, style_dict) {
	style_dict['Colour'] = readColour(elementByName(element, "Colour"));
	style_dict['FontHeight'] = parseInt(elementByName(element, "FontHeight").getAttribute("value"));
	style_dict['HasDropShadow'] = elementByName(element, "HasDropShadow").getAttribute("value");
	style_dict['ShadowColour'] = readColour(elementByName(element, "ShadowColour"));
	style_dict['DropShadowAngle'] = parseInt(elementByName(element, "DropShadowAngle").getAttribute("value"));
	style_dict['DropShadowOffset'] = parseInt(elementByName(element, "DropShadowOffset").getAttribute("value"));
}

function readNGuiGraphicStyle(element, style_dict) {
	// Main entry point for loading graphic style data into the style dict.
	// create style objects for each situation
	var defaultStyle = new Object();
	var highlightStyle = new Object();
	var activeStyle = new Object();
	// populate the dictionaries
	readNGuiGraphicStyleData(elementByName(element, "Default"), defaultStyle);
	readNGuiGraphicStyleData(elementByName(element, "Highlight"), highlightStyle);
	readNGuiGraphicStyleData(elementByName(element, "Default"), activeStyle);
	// combine them all
	style_dict['Default'] = defaultStyle;
	style_dict['Highlight'] = highlightStyle;
	style_dict['Active'] = activeStyle;
}

function readNGuiGraphicStyleData(element, style_dict) {
	style_dict['PaddingX'] = parseInt(elementByName(element, "PaddingX").getAttribute("value"));
	style_dict['PaddingY'] = parseInt(elementByName(element, "PaddingY").getAttribute("value"));
	style_dict['Colour'] = readColour(elementByName(element, "Colour"));
	style_dict['StrokeColour'] = readColour(elementByName(element, "StrokeColour"));
}

function readColour(element) {
	// Read and return a colour struct
	return [elementByName(element, "R").getAttribute("value"),
	elementByName(element, "G").getAttribute("value"),
	elementByName(element, "B").getAttribute("value"),
	elementByName(element, "A").getAttribute("value")];
}

function colourToRGBA(colour) {
	// rgba(255,255,255,1.0) == NMSColour(1.0, 1.0, 1.0, 1.0); we can leave alpha alone
	return "rgba(%s, %s, %s, %s)".format(colour[0]*255, colour[1]*255,
		colour[2]*255, colour[3]);
}

function elementByName(element, name) {
	return element.querySelector(`[name="${name}"]`);
}

// Unused
function getData(element, reqName) {
	var name = element.getAttribute("name");
	var value = element.getAttribute("value");
	if (name == reqName) {
		return value;
	}
	return null;
}

function drawRectangle(x, y, width, height, style) {
	var c = document.getElementById("drawingCanvas");
	var ctx = c.getContext("2d");
	// Save the context so we can restore to it.
	ctx.save();
	ctx.beginPath();
	var defaultStyle = style['Default']
	ctx.fillStyle = colourToRGBA(defaultStyle['Colour']);
	ctx.strokeStyle = colourToRGBA(defaultStyle['StrokeColour']);
	ctx.rect(x, y, width, height);
	//ctx.fillRect(x, y, width, height);
	ctx.fill();
	ctx.stroke();
	ctx.restore();
}
