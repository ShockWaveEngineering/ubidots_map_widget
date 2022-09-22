"use strict";

//--------Account Information for dashboard
const DEVICE_API_LABEL = "33_1_4"; //fixed value specified
var TOKEN = "null"; //retrieved at runtime

var ubidots = new Ubidots();
ubidots.on('receivedToken', function (data)
{
	TOKEN = data;
	console.log("ubidots_map_widget Received Token");

	//try initialise local variables
	InitialiseElements();	
});


//--------Asynchronous Functionality--------
//async socket variables
var socket;
var URL = window.location.hostname + ":443";
var subscribedVars = [];

//function for subscribing using separate callback function
var subscribeVariable = function (ubidots_id, callback_function) 
{
    // Publishes the variable ID that wishes to listen
    socket.emit('rt/variables/id/last_value', {variable: ubidots_id});
    // Listens for changes
    socket.on('rt/variables/' + ubidots_id + '/last_value', function(res){callback_function(res)});
    subscribedVars.push(ubidots_id);
};

//function for subscribing using only an element class
var subscribeVariable2 = function (element) 
{
    // Publishes the variable ID that wishes to listen
    socket.emit('rt/variables/id/last_value', {variable: element.ubidots_id});
    // Listens for changes
    socket.on('rt/variables/' + element.ubidots_id + '/last_value', function(res){element.value_updated_callback(res)});
    subscribedVars.push(element.ubidots_id);
};

// Function to unsubscribed for listening
var unSubscribeVariable = function (variable) 
{
    socket.emit('unsub/rt/variables/id/last_value', {variable: variable});
    var pst = subscribedVars.indexOf(variable);
    if (pst !== -1)
    {
        subscribedVars.splice(pst, 1);
    }
};

var connectSocket = function ()
{
	console.log("Attempting to connect to sokcet");
	// Implements the socket connection
	socket.on('connect', function(){
		socket.emit('authentication', {token: TOKEN});
	});
	window.addEventListener('online', function () {
		socket.emit('authentication', {token: TOKEN});
	});
	socket.on('authenticated', function () {
		subscribedVars.forEach(function (variable_id) {
			socket.emit('rt/variables/id/last_value', { variable: variable_id });
		});
	});
}

function InitialiseRealtimeConnection()
{
	console.log("InitialiseRealtimeConnection called");
	// Implements the connection to the server
    socket = io.connect("https://"+ URL, {path: '/notifications'});
    connectSocket();
    // Should try to connect again if connection is lost
    socket.on('reconnect', connectSocket);    
}

//--------HTTP Requests--------
//Function to get the variable id for a variable with the device api label and variable api label
function GetVariableID(ubidotsVariableObject)
{
    console.log("Trying to get id for api_label: " + ubidotsVariableObject.ubidots_api_label);
    
    var url = 'https://' + window.location.hostname + '/api/v2.0/devices/~' + DEVICE_API_LABEL +'/variables/~' + ubidotsVariableObject.ubidots_api_label + '/';
    $.get(url, { token: TOKEN, page_size: 1 }, function (res) 
    {        
        var obj = JSON.parse(JSON.stringify(res));	
        var new_id = obj.id;
        ubidotsVariableObject.set_VariableID_Callback(new_id);
    });
}

//Function to upload values to Ubidots
function UploadToUbidots(variable_api_label, variable_value)
{
	var url = "https://" + window.location.hostname + "/api/v1.6/devices/" + DEVICE_API_LABEL + "/";
	var headers = {'Content-Type' : 'application/json', 'X-Auth-Token' : TOKEN};
	var data = "{\"" + variable_api_label + "\": {\"value\": " + variable_value + "}}";	
	
	$.post({url: url, headers: headers, data: data});	
}

//////////////////////////////////////////////////////////////////////////////////////////////////////////
function UploadVariableToUbidots(variableApiLabel, variableValue, variableContext)
{
	var url = "https://" + window.location.hostname + "/api/v1.6/devices/" + DEVICE_API_LABEL + "/";
	var headers = {'Content-Type' : 'application/json', 'X-Auth-Token' : TOKEN};
	var data = "{\"" + variableApiLabel + "\": {\"value\": " + variableValue + ", \"context\":" + JSON.stringify(variableContext) + "}}";	
	
	$.post({url: url, headers: headers, data: data});
}

//Function to get a value from ubidots
function GetValueFromUbidots(ubidotsVariableObject) 
{
	var url = "https://" + window.location.hostname + "/api/v1.6/devices/" + DEVICE_API_LABEL + "/" + ubidotsVariableObject.ubidots_api_label + "/values";
	var headers = {'Content-Type' : 'application/json', 'X-Auth-Token' : TOKEN};		

	$.get({url : url, headers : headers}, function(res)
	{		
		var variable_value = res.results[0].value;
		ubidotsVariableObject.value_initialised_callback(variable_value);		
	});
}

function GetVariableFromUbidots(ubidotsVariableObject) 
{
	var url = "https://" + window.location.hostname + "/api/v1.6/devices/" + DEVICE_API_LABEL + "/" + ubidotsVariableObject.ubidots_api_label + "/values";
	var headers = {'Content-Type' : 'application/json', 'X-Auth-Token' : TOKEN};		

	$.get({url : url, headers : headers}, function(res)
	{
		ubidotsVariableObject.value_initialised_callback(JSON.stringify(res.results[0]));		
	});	
}


//--------Element Class Management--------
let element_list = []; //List of element classes to be initialised

function InitialiseElements() //runs the initialise function of all the elements
{
	if(TOKEN == "null" || DEVICE_API_LABEL == "null")
	{
		//console.log("CANNOT initialise elements yet");
	}
	else
	{
		console.log("can now initialise elements");

		//initialise the ubidots async socket
		InitialiseRealtimeConnection();

		//for loop looping through the list of elements, running their initialise functions
		for(var i = 0; i < element_list.length; i++)
		{
			element_list[i].initialise();
		}
	}
}




//--------Map Section--------

//Class declaration
class Ubidots_Variable_Class
{
	
    initialise()
	{
		//Get the id for the ubidots variable
		GetVariableID(this);

		//update the local_value
		GetVariableFromUbidots(this);
	}	

	set_VariableID_Callback(id)
	{
        console.log("set_VariableID_Callback ran for ubidots_api_label: \'" + this.ubidots_api_label + "\'");
		this.ubidots_id = id;
		//now we have the id, we can subscribe to the id to get updates		
		subscribeVariable2(this);
	}

	value_initialised_callback(res) //callback for getting the value initially
	{
		console.log("value_initialised_callback called for \'" + this.ubidots_api_label + "\'");
		this.callback_function(res);
	}

	value_updated_callback(res) //callback for ubidots Async
	{	
        console.log("value_updated_callback called for \'" + this.ubidots_api_label + "\'");		
		this.callback_function(res);
	}

	
	constructor(ubidots_api_label, callback_function)
	{		
		this.ubidots_api_label = ubidots_api_label;
        this.callback_function = callback_function;
		element_list.unshift(this);//add itself to the list of classes that need to be initialised
	}
}

//class initialisation
let end_coordinates = new Ubidots_Variable_Class('end_pos', end_pos_callback);
let centre_coordinates = new Ubidots_Variable_Class('centre_pos', centre_pos_callback);

//Mapbox Settings
mapboxgl.accessToken = 'pk.eyJ1Ijoic2NvdHRhbGV4Z3JheSIsImEiOiJja3lvZ2hjd3MwZGFzMnVuMnlzMGR5OTRmIn0.rv56rls1EfTb-MMKFpIhrg';

//Calculation Settings
const equator_length = 40075.016686; //length of the equator in kilometers
const map_res = 512; //512x512px map resolution (as declared in CSS)
const map_zoom = 15.5; //zoom of the map


//Runtime variables
const pivot_centre = {lng : 29.58742618560791, lat : -28.77507912388993};
const pivot_end = {lng : 29.588925, lat : -28.773606, timestamp : 0};



//Function to update the end_pos age HTML element
function Update_Coordinate_Age_Element()
{ 
    var local_date = new Date(); //this will yield the current date and time of the machine used (UTC +2) example: 14:00    
    var timezone_offset_ms = local_date.getTimezoneOffset() * 60 * 1000;
    var coordinate_creation_date = new Date(pivot_end.timestamp); //The timezone used for the ubidots timestamps are UTC example: 12:00
    var age_date = new Date((local_date.getTime() + timezone_offset_ms) - coordinate_creation_date.getTime());
    document.getElementById("end_pos_last_timestamp").innerHTML = "End Coordinate Age: " + age_date.getHours() + "hours " + age_date.getMinutes() + "minutes " + age_date.getSeconds() + "seconds";
}

//Callback functions for updating the coordinates
function end_pos_callback(res)
{
    var obj = JSON.parse(res);   

    pivot_end.lng = obj.context.lng;
    pivot_end.lat = obj.context.lat;
    pivot_end.timestamp = obj.timestamp;

	//update the orientation of the map
	updateMapOrientation();
	//update additional UI
	updateUI();

    updateRealtimePivotPosition();    
}

function centre_pos_callback(res)
{    
    var obj = JSON.parse(res);
    pivot_centre.lng = obj.context.lng;
    pivot_centre.lat = obj.context.lat;

	//update the orientation of the map
	updateMapOrientation();
	//update additional UI
	updateUI();

    updateRealtimePivotPosition();

	updateEndStopPosition();    
} 

//----------------map object
var map = new mapboxgl.Map({
  container: 'map',
  style: 'mapbox://styles/mapbox/satellite-v9',
  interactive: false,
  center: [29, -28],
  zoom: map_zoom
});




map.on('style.load', () => 
{
    //console.log("map.load event called");

	//--------Sector Application--------
	addSectorSource();
    addSectorLayer();

	//--------End Stops--------
	addEndStopSource();
	addEndStopLayer();

    //--------Pivot Angle Image--------
	addRealtimePivotSource();
	addRealtimePivotLayer(); 
       
});

//----------------Functions for map orientation
function updateMapOrientation()
{
	map.setCenter([pivot_centre.lng, pivot_centre.lat]);

	/*//figure out the distance between the end tower and the centre (to set the zoom of the map)
	var options = {units: 'kilometers'};
    var distance = turf.distance([pivot_centre.lng, pivot_centre.lat], [pivot_end.lng, pivot_end.lat], options) * 1000;

	//figure out the scale of the icon given
    var res_zoom_0 = equator_length * 1000 / 512; //note 512 is tile size
    var res = res_zoom_0 * Math.cos(pivot_centre.lat * Math.PI / 180) / Math.pow(2,map_zoom); //meters/pixel
    var pixels = distance / res;
    var icon_size = pixels/ (pivot_angle_icon_length);*/

}

//----------------Functions for additional map UI elements
function updateUI()
{
	//figure out bearing
    var bearing = turf.bearing([pivot_centre.lng, pivot_centre.lat], [pivot_end.lng, pivot_end.lat]);
    document.getElementById("pivot_bearing").innerHTML = "Pivot Bearing: " + bearing + " deg";
}


//----------------Realtime Pivot Layer

const realtime_pivot_color = "#FFFFFF";
const realtime_pivot_line_width = 2;
const realtime_pivot_end_radius = 8;


//source structure for pivot end position
const geojson_realtime_pivot = 
{
	'type': 'FeatureCollection',
	'features': 
	[
		{
			'type': 'Feature',
			'geometry': 
			{
				'type': 'Point',
				'coordinates': [0, 0]
			}
		}
	]
};

const geojson_realtime_pivot_line = 
{
	'type': 'Feature',
	'properties': {},	
	'geometry': 
	{
		'type': 'LineString',
		'coordinates': [[0,0],[0,0]]
	}	
};

//function for updating the realtime pivot position
function updateRealtimePivotPosition() 
{  
	//update the pivot end position circle
	geojson_realtime_pivot.features[0].geometry.coordinates = [pivot_end.lng, pivot_end.lat];
	map.getSource('realtime_pivot_source').setData(geojson_realtime_pivot);

	//update the pivot line
	geojson_realtime_pivot_line.geometry.coordinates[0] = [pivot_centre.lng, pivot_centre.lat];
	geojson_realtime_pivot_line.geometry.coordinates[1] = [pivot_end.lng, pivot_end.lat];
	map.getSource('realtime_pivot_line_source').setData(geojson_realtime_pivot_line);
}

//enabling and disabling realtime pivot layers
document.getElementById("live_pivot_layer_enable").addEventListener('change', e => {setRealtimePivotVisibility(e);});

function setRealtimePivotVisibility(e)
{
	if(e.target.checked)
	{
		addRealtimePivotLayer();
    }
	else
	{
		removeRealtimePivotLayer();
	}
}


function addRealtimePivotSource()
{
	map.addSource('realtime_pivot_source', 
	{
		'type': 'geojson',
		'data': geojson_realtime_pivot
	});

	map.addSource('realtime_pivot_line_source', 
	{
		'type': 'geojson',
		'data': geojson_realtime_pivot_line
	});
}

function removeRealtimePivotLayer()
{
	if(map.getLayer('realtime_pivot_layer'))
	{
		map.removeLayer('realtime_pivot_layer');
	}
	if(map.getLayer('realtime_pivot_line_layer'))
	{
		map.removeLayer('realtime_pivot_line_layer');
	}	
}

function addRealtimePivotLayer()
{
	//add layer for the line between the centre of the pivot and the end


    //add layer representing the pivot end position
    map.addLayer(
	{
		'id': 'realtime_pivot_layer',
		'type': 'circle',
		'source': 'realtime_pivot_source',
		'paint': 
		{
			'circle-radius': realtime_pivot_end_radius,
			'circle-color': realtime_pivot_color
		}
	});

	map.addLayer(
	{
		'id': 'realtime_pivot_line_layer',
		'type': 'line',
		'source': 'realtime_pivot_line_source',
		'layout': {
			'line-join': 'round',
			'line-cap': 'round'
		},
		'paint': {
			'line-color': realtime_pivot_color,
			'line-width': realtime_pivot_line_width
		}
	});
}


//----------------Sector Layer
const min_heading = 10; //minimum pivot heading in degrees
const max_heading = 180; //maximum pivot heading in degrees

let sector_application_object = new Ubidots_Variable_Class('variable_application_rate', sector_application_callback);


//data structure for storing sector application and pivot min/max angles (will eventually be the context of a ubidots variable)
var sectorApplicationBrowser = 
{
	"sectors":[

	]};


var all_sector_source_data =
{
    'type':'geojson',
    'data': {
        'type':'FeatureCollection',
        'features': [
            /*{
                'type':'Feature',
                'geometry':{
                    'type':'Polygon',
                    'coordinates': []
                }
            }*/
        ]      
    }
};

function sector_application_callback(res)
{
	//Callback called when ubidots updates the variable sector_application
	console.log("sector_application_callback");


    //parse the res parameter as a JSON file
    var obj = JSON.parse(res);
    //create another variable from the context key of the JSON obj
    var context = obj.context;
	//console.log("context:");
	//console.log(context);

    //update the browser version of the context of the sector_application
	UpdateSectorApplicationBrowser(context);

	//update the sectors visually
    UpdateSectorSource();
}

//enabling and disabling realtime pivot layers
document.getElementById("application_sectors_layer_enable").addEventListener('change', e => {setApplicationSectorVisibility(e);});

function setApplicationSectorVisibility(e)
{
	if(e.target.checked)
	{
		addSectorLayer();
    }
	else
	{
		removeSectorLayer();
	}
}

function removeSectorLayer()
{
	if(map.getLayer('application_sectors_outline'))
	{
		map.removeLayer('application_sectors_outline');
	}
	if(map.getLayer('application_sectors'))
	{
		map.removeLayer('application_sectors');
	}
}

function UpdateSectorApplicationBrowser(newContext)
{
	sectorApplicationBrowser = newContext;
}


//Update/Refresh the source of the sector data for the map so it updates visually
function UpdateSectorSource()
{
	console.log("UpdateSectorSource");

    //number of sectors
    var _sectorCount = sectorApplicationBrowser.sectors.length;
	console.log("_sectorCount: " + _sectorCount);

    //new feature form/format
    var new_data = {
        'type':'FeatureCollection',
        'features': [
            {
                'type':'Feature',
                'geometry':{
                    'type':'Polygon',
                    'coordinates': []
                }
            }
        ]        
    };

    var center = [pivot_centre.lng, pivot_centre.lat];      
    var radius = turf.distance([pivot_centre.lng, pivot_centre.lat], [pivot_end.lng, pivot_end.lat], {units: 'kilometers'});   
       
	var options = {steps: 360, units: 'kilometers'};
	//I think if you use a number of steps that creates fractional angles you get strange dividing

    for(let i =0; i < _sectorCount; i++)
    {
        //new_feature data structure for adding a new sector feature
        var new_feature = {
			'type':'Feature',
			'geometry':{
				'type':'Polygon',
				'coordinates': []
			},
			'properties':{
				'sectorIndex':0,
				'application':0
			}
		};
        
        //generate coordinates for particular sector
        var bearing1 = sectorApplicationBrowser.sectors[i].angle;
        var bearing2 = 0;

        //Note all angles are clockwise positive
        if(i < _sectorCount-1)
        {     
			//then there is another sector line afterwards and we can use this as the next angle       
            bearing2 = sectorApplicationBrowser.sectors[i+1].angle;			       
        }
        else
        {
            //this is the last sector, and the next bearing is the first bearing
            bearing2 = sectorApplicationBrowser.sectors[0].angle;
        }        
		
		//generate coordinates for sector
        var turf_sector = turf.sector(center, radius, bearing1, bearing2, options);		

        //Populate the new feature with information from this particular sector
        new_feature.geometry.coordinates = turf_sector.geometry.coordinates; //coordinates for polygon sector
        new_feature.properties.application = sectorApplicationBrowser.sectors[i].application; //application
		new_feature.properties.sectorIndex = i; //index

		
        
        //push the new feature to the new_data json file
        new_data.features.push(new_feature);
    }

	

	//update the source
    map.getSource('sector_source').setData(new_data);
}

function addSectorSource()
{
	map.addSource("sector_source", all_sector_source_data);
}





function addSectorLayer()
{    
    //fill layer
    map.addLayer({
        "id": "application_sectors",
        "type": "fill",
        "source": "sector_source",
        "layout": {},
        "paint": {
            "fill-color": "blue",
            "fill-opacity": 0.4
        }
    });

    //outline
    map.addLayer({
        "id": "application_sectors_outline",
        "type": "line",
        "source": "sector_source",
        "layout": {},
        "paint": {
            "line-color": "#00146c",
            "line-width": 1
        }
    });

    //update the sector information
    UpdateSectorSource();


}

var sectorPopup; //To make sure we only have one instance of a popup at once

//add mouse click event
map.on('click', 'application_sectors', (e) => 
{
	//first we close/remove the popup
	if(sectorPopup != undefined)
	{
		sectorPopup.remove();
	}

	//then start changing the popup info 
	var feature = e.features[0];        

	// Copy coordinates array
	var coordinates = [e.lngLat.lng, e.lngLat.lat];
	var application = feature.properties.application;
	var sectorIndexClicked = feature.properties.sectorIndex;

	
	sectorPopup = new mapboxgl.Popup()
	.setLngLat(coordinates)
	.setHTML(ClickedSector(feature))
	

	sectorPopup.on('open', () =>
	{
		//add event listener
		var inputElement = document.getElementById('inp-sectors-' + sectorIndexClicked);

		inputElement.addEventListener('change', () =>
		{
			OnSectorApplicationModified(sectorIndexClicked, inputElement.value);
		});	
	});	

	sectorPopup.addTo(map);

});


// Change the cursor to a pointer when the mouse is over the places layer.
map.on('mouseenter', 'application_sectors', () => {
	map.getCanvas().style.cursor = 'pointer';
});
    
// Change it back to a pointer when it leaves.
map.on('mouseleave', 'application_sectors', () => {
	map.getCanvas().style.cursor = '';
});



function ClickedSector(feature)
{
	var sectorIndex = feature.properties.sectorIndex;
	var html = "";
	html += "<div>Sector Index: "+ sectorIndex +"</div>";
	html += "<div>Sector Application [mm]:</div>";
	html += "<input id=\'inp-sectors-" + sectorIndex + "\' type=\"number\" step=\"0.1\" value=" + feature.properties.application + ">";
	//html += "<button id=\'btn-sectors-" + sectorIndex + "\'>Save</button>";

	return html;
}

function OnSectorApplicationModified(sectorIndexClicked, newApplication)
{
	console.log("Sector: " + sectorIndexClicked + " application rate: " + newApplication);
	//Update browser/ local variable/json object
	var _sectorCount = sectorApplicationBrowser.sectors.length;
	
	var sectorApplicationBrowser_temp = sectorApplicationBrowser; //create a temporary copy of the sectorApplication

	sectorApplicationBrowser_temp.sectors[sectorIndexClicked].application = newApplication; //modify the temporary variable

	//set the original variable to the temporay variable
	sectorApplicationBrowser = sectorApplicationBrowser_temp;

	//update the sectors on the map with the temporary variable
	UpdateSectorSource();

	//transmit new sectorApplicationBrowser JSON variable to the ubidots context
	UploadVariableToUbidots(sector_application_object.ubidots_api_label, 0, sectorApplicationBrowser);
}


//----------------End Stop Stuff

//enabling and disabling end stop layers
document.getElementById("end_stop_layer_enable").addEventListener('change', e => {setEndStopLayerVisibility(e);});

function setEndStopLayerVisibility(e)
{
	if(e.target.checked)
	{
		addEndStopLayer();		
    }
	else
	{
		removeEndStopSource();		
	}
}

//Draggable end stop things
var end_stop_1_bearing = 30; //degrees
var end_stop_2_bearing = 96; //degrees

//the radius at which to draw the circle
const end_stop_radius = 0.3; //km

const canvas = map.getCanvasContainer();

//I think it would be better to maybe use the centre position or the realtime pivot centre geojson? 
const geojson_end_stop_1 = 
{
	'type': 'FeatureCollection',
	'features': 
	[
		{
			'type': 'Feature',
			'geometry': 
			{
				'type': 'Point',
				'coordinates': [20, 0]
			}
		}
	]
};

const geojson_end_stop_1_line = 
{
	'type': 'Feature',
	'properties': {},	
	'geometry': 
	{
		'type': 'LineString',
		'coordinates': [[0,0],[0,0]]
	}		
};



//function to initialise and update the position of the end stops when the end or centre coordinates change
function updateEndStopPosition()
{
	//const mouse_coords = e.lngLat; //these are the mouse coordinates	
	const centre_coords = [pivot_centre.lng, pivot_centre.lat]; //this is the centre of the map/centre of pivot

	//get the bearing from the centre_coords to the mouse_coords with turf.js
	var point1 = turf.point(centre_coords);		
	var bearing = end_stop_1_bearing;

	//the new coordinates of the circle based on the bearing and radius
	var destination = turf.destination(point1, end_stop_radius, bearing);		
	
	//update the 0th feature in 'geojson_end_stop_1' (aka the draggable element)
	geojson_end_stop_1.features[0].geometry.coordinates = [destination.geometry.coordinates[0], destination.geometry.coordinates[1]];	

	//update the source with the new 'geojson_end_stop_1' json object
	
	map.getSource('end_stop_1').setData(geojson_end_stop_1);
	

	//update the 'geojson_end_stop_1_line' coordinates
	geojson_end_stop_1_line.geometry.coordinates[0] = centre_coords;
	geojson_end_stop_1_line.geometry.coordinates[1] = [destination.geometry.coordinates[0], destination.geometry.coordinates[1]];

	//update the source with the new 'geojson_end_stop_1_line' json object	
	map.getSource('end_stop_1_line').setData(geojson_end_stop_1_line);
	
}

//callback function for the mouse moving the end stop
function onMove(e) 
{
	const mouse_coords = e.lngLat; //these are the mouse coordinates	
	const centre_coords = [pivot_centre.lng, pivot_centre.lat]; //this is the centre of the map/centre of pivot

	//get the bearing from the centre_coords to the mouse_coords with turf.js
	var point1 = turf.point(centre_coords);
	var point2 = turf.point([mouse_coords.lng, mouse_coords.lat]);	
	var bearing = turf.bearing(point1, point2);	

	//the new coordinates of the circle based on the bearing and radius
	var destination = turf.destination(point1, end_stop_radius, bearing);	
	
	// Set a UI indicator for dragging.
	canvas.style.cursor = 'grabbing';
	
	// Update the Point feature in `geojson` coordinates
	// and call setData to the source layer `point` on it.
	geojson_end_stop_1.features[0].geometry.coordinates = [destination.geometry.coordinates[0], destination.geometry.coordinates[1]];
	
	map.getSource('end_stop_1').setData(geojson_end_stop_1);
	

	//update the 'geojson_end_stop_1_line' coordinates
	geojson_end_stop_1_line.geometry.coordinates[0] = centre_coords;
	geojson_end_stop_1_line.geometry.coordinates[1] = [destination.geometry.coordinates[0], destination.geometry.coordinates[1]];

	//update the source with the new 'geojson_end_stop_1_line' json object	
	map.getSource('end_stop_1_line').setData(geojson_end_stop_1_line);
	
}

//callback function for the mouse click being released 
function onUp(e) 
{
	//const coords = e.lngLat;	
	// Unbind mouse/touch events
	map.off('mousemove', onMove);
	map.off('touchmove', onMove);
}

function removeEndStopSource()
{
	if(map.getLayer('end_stop_1_line_layer'))
	{
		map.removeLayer('end_stop_1_line_layer');
	}
	if(map.getLayer('end_stop_1_end'))
	{
		map.removeLayer('end_stop_1_end');
	}
}

function addEndStopSource()
{
	//end stop line	
	map.addSource('end_stop_1_line', 
	{
		'type': 'geojson',
		'data': geojson_end_stop_1_line
	});

	//end stop end	
	map.addSource('end_stop_1', 
	{
		'type': 'geojson',
		'data': geojson_end_stop_1
	});	
}

function addEndStopLayer()
{
	//end stop line		
	map.addLayer(
	{
		'id': 'end_stop_1_line_layer',
		'type': 'line',
		'source': 'end_stop_1_line',
		'layout': {
			'line-join': 'round',
			'line-cap': 'round'
		},
		'paint': {
			'line-color': '#f84c4c',
			'line-width': 4
		}
	});




	//end stop end	
	map.addLayer(
	{
		'id': 'end_stop_1_end',
		'type': 'circle',
		'source': 'end_stop_1',
		'paint': 
		{
			'circle-radius': 10,
			'circle-color': '#f84c4c' //
		}
	});

		// When the cursor enters a feature in
	// the point layer, prepare for dragging.
	map.on('mouseenter', 'end_stop_1_end', () => 
	{
		map.setPaintProperty('end_stop_1_end', 'circle-color', '#b33737');
		canvas.style.cursor = 'move';
	});
	
	map.on('mouseleave', 'end_stop_1_end', () => 
	{
		map.setPaintProperty('end_stop_1_end', 'circle-color', '#f84c4c');
		canvas.style.cursor = '';
	});
	
	map.on('mousedown', 'end_stop_1_end', (e) => 
	{
		// Prevent the default map drag behavior.
		e.preventDefault();		
		canvas.style.cursor = 'grab';		
		map.on('mousemove', onMove);
		map.once('mouseup', onUp);
	});
	
	//I think this is for touch devices
	map.on('touchstart', 'end_stop_1_end', (e) => 
	{
		if (e.points.length !== 1) return;
		
		// Prevent the default map drag behavior.
		e.preventDefault();
		
		map.on('touchmove', onMove);
		map.once('touchend', onUp);
	});
}

//----------------Synchronous Interval Calls
window.setInterval(Update_Coordinate_Age_Element, 1000); //update the age of the end_pos every 1000ms

