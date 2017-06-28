/*############################################################
/*    App name:         CasparController
/*    App discription:  An app for triggering playout
/*                      from an atem mixer
/*    App version:      1.0.2
/*    Author:           Andreas Andersson
/*    Contact:          andreas@amedia.nu
/*#########################################################*/

const {shell}           = require('electron');
const {ipcRenderer}     = require('electron');
const CasparCG          = require("caspar-cg"); // Load the CasparCG module
const settings          = require('electron-settings'); // Load the DB module
const Atem              = require('atem'); // Load the atem module
const xkeys             = require('node-xkeys'); // Load the x-keys module

var lastChanged         = '';
var isFirst             = 1;
var myAtemDevice        = new Atem(settings.get("atem.ip"));
var serverIp            = settings.get("ccg.ip");
var ccg                 = new CasparCG(serverIp, 5250);
var run                 = false;
var playByATEM          = false;
var LogoOn              = false;
var ClockOn             = false;
var sheme               = { };
var listCounter         = 0;
var teleprompterRun     = 0;
var menuStatus          = 'closed';
var globalData          = new Array();
var autoplayArr         = new Array();
globalData["xkeysOn"]   = true;
require('./renderer.js');

$( document ).ready( function(){
  $("#ccg_dot").removeClass().addClass("red");  //Sets casparCG connection indicator to default (red, false)
  $("#atem_dot").removeClass().addClass("red"); //Sets ATEM connection indicator to default (red, false)
  xkeys.openFirst(xkeys.XK_24, function(err){
    //Trys to connect to X-keys controll surface if faild sets "xkeysOn" to false
    if(err){
      globalData["xkeysOn"] = false;
      ipcRenderer.send('asynchronous-message', "Inte ansluten till X-keys. Fortsätter utan kontrollyta.");
    }
  });
  if (globalData["xkeysOn"]){
    //If connection success: sends message to log, turns off controll surface lights, turns on first keys light
    ipcRenderer.send('asynchronous-message', "Ansluten till X-keys kontrollyta.");
    xkeys.setAllBlueBackLights(false);
    xkeys.setAllRedBackLights(false);
    xkeys.setRedBackLight(0, true, false);
  }
});

/*---- ccgRun() ----
  Starts and stops the interface for controlling CasparCG
*/
function ccgRun(){
  if (!run){
    //If program not started
    $(".btn_run").css("background-image", "url('assets/img/btn.gif')"); //Sets "blinking" background for first button
    doAjax(serverIp, function(result, exception){
      //Calls Ajax function
      if (result == true ){
        //If Ajax request succeeds
        $(".btn_run").css("background-image", "url('assets/img/btn_blue.jpg')"); //Sets first key to blue
        ipcRenderer.send('asynchronous-message', "Hämtningen av spellista lyckades"); //Sends message to log
        ccg.connect(function () {
          //Trys to connect to CasparCG server
          loadToCCG(sheme[listCounter].file, listCounter); //Loads first file from Ajax return
        });
        ccg.on("connected", function () {
          $("#ccg_dot").removeClass().addClass("green"); //Sets casparCG connection indicator to default (green, true)
          ToggleLights(1); //Turns lights on
          globalData["playflag"] = 0; //Tell whether caspar is playing or not
          globalData["pauseCount"] = 0; //Count pause commands protects from doubble send
          ipcRenderer.send('asynchronous-message', "Ansluten till CasparCG server on "+serverIp); //Sends message to log
        });
        ccg.on("ccgData", function (data, err) {
          //Sends messages or errors from casparcg to log
          ipcRenderer.send('asynchronous-message', data);
          if (err){
            ipcRenderer.send('asynchronous-message', null, err);
          }
        });
      }
      else{
        //If Ajax request fails
        $(".btn_run").css("background-image", "url('assets/img/btn_red.jpg')"); //Sets first key to red
        err = "Kunde inte ladda körshema. "
        $("#message").removeClass().addClass('error').text(err).animate({top: "0px"}, 400).delay(2000).animate({top: "-38px"}, 800); //Flash error message
        ipcRenderer.send('asynchronous-message', null, err+exception); //Sends error to log
        run = !run; //Set program run to true
      }
    });
  }
  else{
    //If program is already running
    listCounter = 0; //Resets the listpointer to 0
    clearInterval(globalData['progressBar']); //In case counter is running stops it
    clearInterval(globalData['resync']);
    ccg.clear("2"); //Clears caspar chanel 2
    ccg.clear("1"); //Clears caspar chanel 1
    ccg.clear("3"); //Clears caspar chanel 3
    setTimeout(function(){ccg.disconnect();},200); //Disconnect from casparCG
    $("#ccg_dot").removeClass().addClass("red"); //Sets casparCG connection indicator to default (red, false)
    $('#list').remove(); //Removes playlist from GUI
    sheme = { }; //Empty playlist array
    ToggleLights(0);
    PrompterRun("off");
    ipcRenderer.send('asynchronous-message', "clr", "clr"); //Sends clear to log
  }
  run = !run; //Set program run to false
}

/*---- doAjax() ----
  #serverIp as a string, ip-adress of remote server
  #callback as a function
  Sends an ajax get request to a remote server and returns an playlist as an array
*/
function doAjax(serverIp, callback)
{
  $.ajax({
    type: 'GET',
    url: 'http://'+serverIp+'/rundown/json',
    data: { get_param: 'value' },
    dataType: 'json',
    error: function(jqXHR, exception){
      //If the request fails
      if (jqXHR.status === 0) {
          exception = 'Not connect Verify Network.';
      } else if (jqXHR.status == 404) {
          exception = 'Requested page not found. [404]';
      } else if (jqXHR.status == 500) {
          exception = 'Internal Server Error [500].';
      } else if (exception === 'parsererror') {
          exception = 'Requested JSON parse failed.';
      } else if (exception === 'timeout') {
          exception = 'Time out error.';
      } else if (exception === 'abort') {
          exception = 'Ajax request aborted.';
      } else {
          exception = 'Uncaught Error. ' + jqXHR.responseText;
      }
      callback(false, exception); //Sends callback "false" and error message
    },
    success: function(data){
      //If the request succeds
      sheme = data;
      $('<ul id="list"></ul>').appendTo('#rundown-list');
      $.each(data, function(index, element) {
//        sheme.push(element.file);
        title = element.file;
        autoplayIMG = '';
        if (title.length>45){
          title = element.file.substring(0, 45);
        }
        if(element.autoplay){
          autoplayIMG = '<img src="assets/img/autoplay.png" class="autoplayIcon">';
          if (title.length>40){
            title = element.file.substring(0, 35);
          }
        }
        timecode = getTimecode(element.frames, element.fps);
        $('<li class="list-item" id="list-item'+index+'" onclick="loadFromList(\''+element.file+'\',\''+index+'\');">'+title+autoplayIMG+'<div class="myProgress"><div class="myBar" id="timebar'+index+'">'+timecode+'</div></div></li>').appendTo('#list');
      });
      callback(true); //Sends callback "true";
    },
    timeout: 3000 //Gives up after 3 seconds
  });
}

/*---- loadToCCG() ----
  #file as string filename of the requested file
  #counter as an int
  Trys to load the file to casparCG
*/
function loadToCCG(file, counter){
  options = {transition: "CUT",filter: "1 Linear RIGHT"}
  if (sheme[counter].autoplay) options = {transition: "CUT",filter: "1 Linear RIGHT",auto: "AUTO"}
  ccg.load("2-1", file, options, function(err, data){
    $(".list-item").removeClass("loaded");  //Removes loaded class from previous loaded file in list
    $(".list-item").removeClass("autoloaded");  //Removes autoloaded class from previous loaded file in list
    $(".list-item").removeClass("warning"); //Removes warning class from previous loaded file in list
    //To indicate file error this does not remove error clas from list item
    if (err){
      //If casparCG returns an error
      $("#list-item"+counter).addClass("error"); //Adds error class to list item
      $("#message").removeClass().addClass('error').text('Kunde inte ladda filen: '+err).animate({top: "0px"}, 400).delay(2000).animate({top: "-38px"}, 800); //Flash error message
      ipcRenderer.send('asynchronous-message', null, 'Kunde inte ladda filen: '+err); //Sends errror to log
    }
    else{
        if (sheme[counter].frames != "undefined" && sheme[counter].fps != "undefined"){
          //If media info is available
          globalData['counter'] = true; //Counter is available
          globalData['frames'] = sheme[counter].frames; // Get frames from media info. Countdown
          globalData['framesTot'] = sheme[counter].frames; // Get frames from media info. Static
          globalData['fps'] = Math.ceil(sheme[counter].fps); // Get fps from media info, rounds off decimal values (ex:23,976 to 24)
          globalData["width"] = 1; //initialize the width of the progressBar
          globalData["barEvery"] = Math.ceil(sheme[counter].frames/100); // Counts how many frames it take to advance bar 1%
          $("#list-item"+counter).addClass("loaded"); //Adds loaded class to list item
          timecode = getTimecode(globalData['frames'], globalData['fps']);
          $('#timebar'+counter).text(timecode);
          $("#timebar"+counter).width('1%'); //Sets progress bar to 100%
        }
        else{
          globalData['counter'] = false; //No counter available
          $("#list-item"+counter).addClass("warning"); //Adds warning class to list item
        }
      }
    if (teleprompterRun){
      ccg.load("3-10", file)
    }
  });
}
function autoLoadToCCG(file, counter){
  console.log(file+' '+counter);
  options = {transition: "CUT",filter: "1 Linear RIGHT",auto: "AUTO"}
  ccg.loadBg("2-1", file, options, function(err, data){
    if (err){
      //If casparCG returns error - no media information is available
      globalData['counter'] = false; //No counter available
      $("#list-item"+counter).addClass("warning"); //Adds warning class to list item
    }
    else{
        if (sheme[counter].frames != "undefined" && sheme[counter].fps != "undefined"){
          autoplayArr['counter'] = true; //Counter is available
          autoplayArr['frames'] = sheme[counter].frames; // Get frames from media info. Countdown
          autoplayArr['framesTot'] = sheme[counter].frames; // Get frames from media info. Static
          autoplayArr['fps'] = Math.ceil(sheme[counter].fps); // Get fps from media info, rounds off decimal values (ex:23,976 to 24)
          autoplayArr["barEvery"] = Math.ceil(sheme[counter].frames/100); // Counts how many frames it take to advance bar 1%
          $("#list-item"+counter).addClass("autoloaded"); //Adds loaded class to list item
        }
      }
  });
}
/*---- sendPlayToCCG() ----
  Trys play loaded file in casparCG
*/
function sendPlayToCCG(){
  if(run && !globalData["playflag"]){
    //If program is running and caspar is not playing
    file = sheme[listCounter].file;
    ccg.play("2-1", file, '', function (err, data) {
      if(err){
        //If casparCG returns error
        ipcRenderer.send('asynchronous-message', null, err); //Send error to log
        return;
      }
      else{
        if (teleprompterRun) ccg.play("3-10", file);
        globalData["playflag"] = 1; //Tells that caspar is playing
        globalData["pauseCount"] = 0; //Resets pauseflag (it's now posible to pause)
        if (globalData['counter']){
          interval = 5000;
          if (globalData['framesTot']/globalData['fps']>30) interval = 10000;
          globalData['progressBar']   = setInterval(TimecodeBar, 1000/globalData["fps"]); //Starts progressbar
          globalData['resync']        = setInterval(function(){
            ccg.info("2-1", function(err, data){
              if (data && globalData['frames']/globalData['fps']>5){
                resyncedFrames = Math.ceil(data.framesLeft/(data.length/globalData['framesTot']));
                if (globalData['frames'] != resyncedFrames){
                  globalData['frames'] = resyncedFrames;
                }
              }
            });
          },interval)
        }
        if (sheme[listCounter].autoplay && typeof sheme[parseInt(listCounter)+1] != "undefined"){
          autoLoadToCCG(sheme[parseInt(listCounter)+1].file, parseInt(listCounter)+1);
        }
      }
    });
  }
}

/*---- sendPauseToCCG() ----
  Trys to paude casparCG playout
*/
function sendPauseToCCG(){
  if(run && globalData["pauseCount"]<1){
    //If program is running and pausecammand is not the last comand sent
    ccg.pause("2-1", function(err, data){

      if (err){
        //If casparCG returns error
        ipcRenderer.send('asynchronous-message', null, err); //Send error to log
        globalData["pauseCount"] = 0; //Resets pauseflag
      }
      else {
        if (teleprompterRun) ccg.pause("3-10");
        clearInterval(globalData['progressBar']);
        clearInterval(globalData['resync']);
        globalData["pauseCount"] = 1; //Tells that pause has been sent
        globalData["playflag"] = 0; //Resets playflag
      }
    });
  }
}

/*---- nextOnList() ----
  Loads the next mediafile in list
*/
function nextOnList(){
  if(run){
    //If program is running
    if (globalData["playflag"]){
      ccg.stop("2-1"); //If caparCG playing stops casparCG playout
      clearInterval(globalData['progressBar']); //In case counter is running stops it
      clearInterval(globalData['resync']);
    }
    listCounter++; //Moves pointer one position forward
    if(listCounter==sheme.length){
      //If pointer reaches end of list; reset pointer
      listCounter=0;
    }
    if (listCounter !=0 && sheme[parseInt(listCounter-1)].autoplay){
      $(".list-item").removeClass("loaded");  //Removes loaded class from previous loaded file in list
      $(".list-item").removeClass("autoloaded");  //Removes loaded class from previous loaded file in list
      $(".list-item").removeClass("warning"); //Removes warning class from previous loaded file in list
      $("#list-item"+listCounter).addClass("loaded"); //Adds loaded class to list item
      if (sheme[listCounter].frames != "undefined" && sheme[listCounter].fps != "undefined"){
        globalData['counter']   = true;
        globalData['frames']    = sheme[listCounter].frames;
        globalData['framesTot'] = sheme[listCounter].frames;
        globalData['fps']       = sheme[listCounter].fps;
        globalData["width"]     = 1;
        globalData["barEvery"]  = Math.ceil(sheme[listCounter].frames/100);;
      }

      options = {transition: "CUT",filter: "1 Linear RIGHT"}
      if (sheme[listCounter].autoplay) options = {transition: "CUT",filter: "1 Linear RIGHT",auto: "AUTO"}
      ccg.play("2-1", sheme[listCounter].file, options);
      if (globalData['counter']){
        interval = 5000;
        if (globalData['framesTot']/globalData['fps']>30) interval = 10000;
        globalData['progressBar']   = setInterval(TimecodeBar, 1000/globalData["fps"]); //Starts progressbar
        globalData['resync']        = setInterval(function(){
          ccg.info("2-1", function(err, data){
            if (data && globalData['frames']/globalData['fps']>5){
              resyncedFrames = Math.ceil(data.framesLeft/(data.length/globalData['framesTot']));
              if (globalData['frames'] != resyncedFrames){
                globalData['frames'] = resyncedFrames;
              }
            }
          });
        },interval)
      }
      if (sheme[listCounter].autoplay && sheme[parseInt(listCounter)+1] != "undefined"){
        autoLoadToCCG(sheme[parseInt(listCounter)+1].file, parseInt(listCounter)+1);
      }
    }
    else{
      loadToCCG(sheme[listCounter].file, listCounter);
      globalData["playflag"] = 0; //Resets playflag
    }
  }
}

/*---- previousOnList() ----
  Loads the previous mediafile in list
*/
function previousOnList(){
  if(run){
    //If program is running
    if (globalData["playflag"]){
      ccg.stop("2-1"); //If caparCG playing stops casparCG playout
      clearInterval(globalData['progressBar']); //In case counter is running stops it
      clearInterval(globalData['resync']);
    }
    if (listCounter>0){
      //If pointer isn't at the first position; move pointer one positon backwards
      listCounter--;
    }
    loadToCCG(sheme[listCounter].file, listCounter);
    globalData["playflag"] = 0; //Resets playflag
  }
}

/*---- loadFromList() ----
  #file as string filename of the requested file
  #counter as int the position in the list
  Loads the file that has been clicked on in list
*/
function loadFromList(file, counter){
  if(run && counter != listCounter){
    //If program is running
    if (globalData["playflag"]){
      ccg.stop("2-1"); //If caparCG playing stops casparCG playout
      clearInterval(globalData['progressBar']); //In case counter is running stops it
      clearInterval(globalData['resync']);
    }
    globalData["playflag"] = 0; //Resets playflag
    listCounter = counter; //Sets the pointer to the clicked file
    loadToCCG(file, counter);
  }
}

function nudge(direction, frames) {
  if (run && !globalData["playflag"]){
    file            = sheme[listCounter].file
    mediaPosition   = globalData['framesTot'] - globalData["frames"];

    if (direction == "forward" && globalData['framesTot']>mediaPosition+frames) {
      newPosition   = mediaPosition + frames;
      options       = {seek:newPosition};
      ccg.load("2-1", file, options, function(err, data){
        if (err){
          ipcRenderer.send('asynchronous-message', null, err); //Send error to log
        }
        else {
          globalData["frames"] = globalData["frames"] - frames;
          barWidht = Math.round(100-globalData['frames']/globalData['framesTot']*100);
          if (barWidht<1) barWidht = 1;
          $("#timebar"+listCounter).width(barWidht+'%');
          $("#timebar"+listCounter).text(getTimecode(globalData["frames"], globalData["fps"])); //Get remaining media duration with getTimecode()
        }
      });
    }
    else if (direction == "backward" && mediaPosition-frames>0) {
      newPosition   = mediaPosition - frames;
      options       = {seek:newPosition};
      ccg.load("2-1", file, options, function(err, data){
        if (err){
          ipcRenderer.send('asynchronous-message', null, err); //Send error to log
        }
        else {
          globalData["frames"] = globalData["frames"] + frames;
          barWidht = Math.round(100-globalData['frames']/globalData['framesTot']*100);
          if (barWidht<1) barWidht = 1;
          $("#timebar"+listCounter).width(barWidht+'%');
          $("#timebar"+listCounter).text(getTimecode(globalData["frames"], globalData["fps"])); //Get remaining media duration with getTimecode()
        }
      });
    }
  }
}

function ChannelClock() {
  if(run && !ClockOn){
    clockTransition = settings.get('clock.transition');
    clockpos        = settings.get('clock.position');
    clockcolor      = settings.get('clock.color');
    clocbgkcolor    = settings.get('clock.bgColor');
    clockopacity    = settings.get('clock.opacity');
    var TemplateData = '<templateData><componentData id=\\"transition\\"><data id=\\"text\\" value=\\"'+clockTransition+'\\"/></componentData><componentData id=\\"position\\"><data id=\\"text\\" value=\\"'+clockpos+'\\"/></componentData><componentData id=\\"color\\"><data id=\\"text\\" value=\\"'+clockcolor+'\\"/></componentData><componentData id=\\"bgcolor\\"><data id=\\"text\\" value=\\"'+clocbgkcolor+'\\"/></componentData><componentData id=\\"opacity\\"><data id=\\"text\\" value=\\"'+clockopacity+'\\"/></componentData></templateData>'
    ccg.loadTemplate("1-98", 'HDA_DEFAULT/HDA CLOCK', 1, TemplateData);
    $("#btn_clock").removeClass('btn_l_red').addClass("btn_l_blue");
    if (globalData["xkeysOn"]){
      xkeys.setRedBackLight(3, false, false);
      xkeys.setRedBackLight(11, false, false);
      xkeys.setBlueBackLight(3, true, false);
      xkeys.setBlueBackLight(11, true, false);
    }
    ClockOn = true;
  }
  else if (run){
    ccg.stopTemplate("1-98", function(err, data){
      if (err){
        ipcRenderer.send('asynchronous-message', null, err); //Send error to log
        return;
      }
      else{
        $("#btn_clock").removeClass('btn_l_blue').addClass("btn_l_red");
        if (globalData["xkeysOn"]){
          xkeys.setRedBackLight(3, true, false);
          xkeys.setRedBackLight(11, true, false);
          xkeys.setBlueBackLight(3, false, false);
          xkeys.setBlueBackLight(11, false, false);
        }
        ClockOn = false;
      }
    });
  }
}

function ChannelLogo() {
  if(run && !LogoOn){
    logoTransition  = settings.get('logo.transition');
    logopos         = settings.get('logo.position');
    logoopacity     = settings.get('logo.opacity');
    var TemplateData = '<templateData><componentData id=\\"transition\\"><data id=\\"text\\" value=\\"'+logoTransition+'\\"/></componentData><componentData id=\\"position\\"><data id=\\"text\\" value=\\"'+logopos+'\\"/></componentData><componentData id=\\"opacity\\"><data id=\\"text\\" value=\\"'+logoopacity+'\\"/></componentData></templateData>'
    ccg.loadTemplate("1-99", 'HDA_DEFAULT/HDA LOGO', 1, TemplateData);
    $("#btn_logo").removeClass('btn_l_red').addClass("btn_l_blue");
    if (globalData["xkeysOn"]){
      xkeys.setRedBackLight(19, false, false);
      xkeys.setRedBackLight(27, false, false);
      xkeys.setBlueBackLight(19, true, false);
      xkeys.setBlueBackLight(27, true, false);
    }
    LogoOn = true;
  }
  else if(run){
    ccg.stopTemplate("1-99", function(err, data){
      if (err){
        ipcRenderer.send('asynchronous-message', null, err); //Send error to log
        return;
      }
      else{
        $("#btn_logo").removeClass('btn_l_blue').addClass("btn_l_red");
        if (globalData["xkeysOn"]){
          xkeys.setRedBackLight(19, true, false);
          xkeys.setRedBackLight(27, true, false);
          xkeys.setBlueBackLight(19, false, false);
          xkeys.setBlueBackLight(27, false, false);
        }
        LogoOn = false;
      }
    });
  }
}

/*---- TimecodeBar() ----
  Displays the progressbar in GUI and calculates the progress
*/
function TimecodeBar() {
  if (globalData["frames"] <= 0) {
    //If ther ar no frames left
  	$("#timebar"+listCounter).width('100%'); //Sets progress bar to 100%
    clearInterval(globalData['progressBar']); //Stops the counter
    clearInterval(globalData['resync']);
    if (sheme[listCounter].autoplay && sheme[parseInt(listCounter)+1] != 'undefined'){
      $(".list-item").removeClass("loaded");  //Removes loaded class from previous loaded file in list
      $(".list-item").removeClass("autoloaded");  //Removes loaded class from previous loaded file in list
      $(".list-item").removeClass("warning"); //Removes warning class from previous loaded file in list
      globalData['counter']   = autoplayArr['counter'];
      globalData['frames']    = autoplayArr['frames'];
      globalData['framesTot'] = autoplayArr['framesTot'];
      globalData['fps']       = autoplayArr['fps'];
      globalData["width"]     =  1;
      globalData["barEvery"]  = autoplayArr["barEvery"];
      listCounter++
      $("#list-item"+listCounter).addClass("loaded"); //Adds loaded class to list item
      if (sheme[listCounter].autoplay && sheme[parseInt(listCounter)+1] != "undefined"){
        autoLoadToCCG(sheme[parseInt(listCounter)+1].file, parseInt(listCounter)+1);
      }
      globalData['progressBar']   = setInterval(TimecodeBar, 1000/globalData["fps"]); //Starts progressbar


    }
  } else {
    //If ther are frames left
    globalData["frames"]--; //Subtrackt the frames by 1
    if (globalData["frames"] % globalData["barEvery"] == 0){
      //If the file has been playd 1% of total length
    	globalData["width"]++; //Move progress bar 1%
    	$("#timebar"+listCounter).width(globalData["width"] + '%');
    }
    $("#timebar"+listCounter).text(getTimecode(globalData["frames"], globalData["fps"])); //Get remaining media duration with getTimecode()
  }
}

/*---- getTimecode() ----
  #frames as int the total amount of frames in a mediafile
  #fps as int the frame rate of a mediafile
  Returns the duration in HH:MM:SS:FF as a string
*/
function getTimecode(frames, fps){
  var buffer = 0;
  var HH = Math.floor(frames / (60*60*fps));
  buffer = frames - HH*60*60*fps;
  var MM = Math.floor(buffer / (60*fps));
  buffer = frames - MM*60*fps;
  var SS = Math.floor(buffer / fps);
  var FF = buffer - (SS * fps);
  var timecode = "\u00A0"+("0"+HH).slice(-2)+':'+("0"+MM).slice(-2)+':'+("0"+SS).slice(-2)+':'+("0"+FF).slice(-2);
  return timecode;
}

/*---- ToggleLights() ----
  #OnF as a bool
  If true, turns on lights on x-keys surface and changes buttons in GUI
  IF false, turns of lights and changes buttons in GUI
*/
function ToggleLights(OnF){
  if (OnF == 1){
    //If OnF = true turns lights on
    $(".btn").removeClass().addClass("btn_blue"); //Gets all .btn elements and adds btn_blue class
    $(".btn_l").removeClass("btn_l").addClass("btn_l_red"); //Gets all .btn_l elements and adds btn_l_red class
    $(".btn_prompter_run").addClass("btn_prompter_red");
    if (globalData["xkeysOn"]){
      //If x-keys surface is connected turn on lights
      xkeys.setRedBackLight(0, false, false);
      xkeys.setBlueBackLight(0, true, false);
      //xkeys.setRedBackLight(24, true, false);

      xkeys.setBlueBackLight(1, true, false);
      xkeys.setBlueBackLight(9, true, false);
      xkeys.setBlueBackLight(17, true, false);
      xkeys.setBlueBackLight(25, true, false);

      xkeys.setBlueBackLight(2, true, false);
      xkeys.setBlueBackLight(10, true, false);
      xkeys.setBlueBackLight(18, true, false);
      xkeys.setBlueBackLight(26, true, false);

      xkeys.setRedBackLight(3, true, false);
      xkeys.setRedBackLight(11, true, false);
      xkeys.setRedBackLight(19, true, false);
      xkeys.setRedBackLight(27, true, false);

      xkeys.setRedBackLight(4, true, false);

      // xkeys.setBlueBackLight(5, true, false);
      // xkeys.setBlueBackLight(13, true, false);
      // xkeys.setBlueBackLight(21, true, false);
      // xkeys.setBlueBackLight(29, true, false);
    }
  }
  else if (OnF == 0) {
    //If OnF = false turns off lights
    $(".btn_blue").removeClass('btn_blue').addClass("btn"); //Gets all .btn_blue elements and adds btn class
    $(".btn_l_blue").removeClass().addClass("btn_l"); //Gets all .btn_l_blue elements and adds btn_l class
    $(".btn_l_red").removeClass().addClass("btn_l"); //Gets all .btn_l_red elements and adds btn_l class
    $(".btn_run").css("background-image", "url('assets/img/btn_red.jpg')"); //Change background-image on start button
    $(".btn_prompter_run").removeClass("btn_prompter_red btn_prompter_blue");
    if (globalData["xkeysOn"]){
      //If x-keys surface is connected turn off lights
      xkeys.setRedBackLight(24, false, false);
      xkeys.setRedBackLight(0, true, false);
      xkeys.setBlueBackLight(0, false, false);

      xkeys.setBlueBackLight(1, false, false);
      xkeys.setBlueBackLight(9, false, false);
      xkeys.setBlueBackLight(17, false, false);
      xkeys.setBlueBackLight(25, false, false);

      xkeys.setBlueBackLight(2, false, false);
      xkeys.setBlueBackLight(10, false, false);
      xkeys.setBlueBackLight(18, false, false);
      xkeys.setBlueBackLight(26, false, false);

      xkeys.setRedBackLight(3, false, false);
      xkeys.setRedBackLight(11, false, false);
      xkeys.setRedBackLight(19, false, false);
      xkeys.setRedBackLight(27, false, false);
      xkeys.setBlueBackLight(19, false, false);
      xkeys.setBlueBackLight(27, false, false);
      xkeys.setBlueBackLight(3, false, false);
      xkeys.setBlueBackLight(11, false, false);

      xkeys.setRedBackLight(4, false, false);

      // xkeys.setBlueBackLight(5, false, false);
      // xkeys.setBlueBackLight(13, false, false);
      // xkeys.setBlueBackLight(21, false, false);
      // xkeys.setBlueBackLight(29, false, false);
    }
  }
}

/*---- loadContent() ----
  #page as a string
  Displays and hides parts of the GUI
*/
function loadContent(page){
  if (page == "home"){
    //If requested page is home
    $("#settingspage").addClass("hidden"); //Hides settings page
    $("#homepage").removeClass("hidden"); //Displays homepage
  }
  else if (page == "settings"){
    //If requested page is settings
    atem_type       = settings.get('atem.type'); //Gets saved data from DB
    ccg_inupt       = settings.get('ccg.input');
    logoTransition  = settings.get('logo.transition');
    logopos         = settings.get('logo.position');
    logoopacity     = settings.get('logo.opacity');
    clockTransition = settings.get('clock.transition');
    clockpos        = settings.get('clock.position');
    clockcolor      = settings.get('clock.color');
    clocbgkcolor    = settings.get('clock.bgColor');
    clockopacity    = settings.get('clock.opacity');
    $("#homepage").addClass("hidden"); //Hides homepage
    $("#settingspage").removeClass("hidden"); //Displays settings page
    $('form.box').find('input[name=atemIp]').attr('value',settings.get('atem.ip')); //Search for inputbox and apdends data from DB
    $('form.box').find('input[name=ccgIp]').attr('value',settings.get('ccg.ip'));
    inputs = parseInt(atem_type); //Gets number of inputs from mixer model
    for (inputCount = 1; inputCount<inputs+1; inputCount++){
      $('<option value="'+inputCount+'">'+inputCount+'</option>').appendTo('select[name=ccgInput]'); //Apends input selsctions
    }
    $('select[name=atemtype]').find('option[value='+atem_type+']').attr('selected','selected'); //Selects stored data
    $('select[name=ccgInput]').find('option[value='+ccg_inupt+']').attr('selected','selected');
    $('select[name=logoTransition]').find('option[value='+logoTransition+']').attr('selected','selected');
    $('select[name=clockTransition]').find('option[value='+clockTransition+']').attr('selected','selected');
    $('input[value='+logopos+']').attr('checked', 'checked');
    $('input[value='+clockpos+']').attr('checked', 'checked');
    $('form.box').find('input[name=clockcolor]').value = clockcolor;
    $('form.box').find('input[name=clocbgkcolor]').attr('value',clocbgkcolor);
    $('form.box').find('input[name=clockopacity]').attr('value',clockopacity);
    $('form.box').find('input[name=logoopacity]').attr('value',logoopacity);
  }
}

/*---- ValidateIPaddress() ----
  #ipadress as a string
  Test a variable against a ip-adress pattern returns true if a match is found
*/
function ValidateIPaddress(ipadress){
  var ipformat = /^(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/;
  if(ipadress.match(ipformat)){return true;}
  else{return false;}
}

/*---- ValidateIPaddress() ----
  Saves form in DB
*/
function saveSettings(){
  if(run){
    //If program is running
    $("#message").removeClass().addClass('error').text('Kan inte spara när systemet är i drift.').animate({top: "0px"}, 400).delay(2000).animate({top: "-38px"}, 800); //Flash error
    return;
  }
  atem_ip               = $('input[name=atemIp]').val();
  atem_type             = $('select[name=atemtype]').val();
  ccg_ip                = $('input[name=ccgIp]').val();
  ccg_inupt             = $('select[name=ccgInput]').val();
  pgm_logo_pos          = $('input[name=logopos]:checked').val();
  pgm_logo_transition   = $('select[name=logoTransition]').val();
  pgm_logo_opacity      = $('input[name=logoopacity]').val();
  pgm_clock_pos         = $('input[name=clockpos]:checked').val();
  pgm_clock_transition  = $('select[name=clockTransition]').val();
  pgm_clock_color       = $('input[name=clockcolor]').val();
  pgm_clock_bg          = $('input[|name=clocbgkcolor]').val();
  pgm_clock_opacity     = $('input[name=clockopacity]').val();

  if (!ValidateIPaddress(atem_ip)){
    //If the given ip adress is not valid
    $("#message").removeClass().addClass('error').text('Felaktigt angiven ip-adress för ATEM.').animate({top: "0px"}, 400).delay(2000).animate({top: "-38px"}, 800); //Flash error
    return;
  }
  if (!ValidateIPaddress(ccg_ip)){
    //If the given ip adress is not valid
    $("#message").removeClass().addClass('error').text('Felaktigt angiven ip-adress för CasparCG.').animate({top: "0px"}, 400).delay(2000).animate({top: "-38px"}, 800); //Flash error
    return;
  }
  if (ccg_ip === atem_ip){
    //If CasparCG and atem ip is the same
    $("#message").removeClass().addClass('error').text('ip-adresserna kan inte vara samma.').animate({top: "0px"}, 400).delay(2000).animate({top: "-38px"}, 800); //Flash error
    return;
  }
  //Else saves the data to DB
  settings.set('atem', {
     ip: atem_ip,
     type: atem_type
   });
   settings.set('ccg', {
     ip: ccg_ip,
     input: ccg_inupt
   });
   settings.set('logo', {
     position: pgm_logo_pos,
     transition: pgm_logo_transition,
     opacity: pgm_logo_opacity
   });
   settings.set('clock', {
     position: pgm_clock_pos,
     transition: pgm_clock_transition,
     color: pgm_clock_color,
     bgColor: pgm_clock_bg,
     opacity: pgm_clock_opacity
   });
   location.reload(); //Reloades program
}

/*---- OpenURL() ----
  #url as a string
  Opens a external url in the default browser
*/
function OpenURL(url){
  if (ValidateIPaddress(url)){
    //if url is ip-adress adds http:// before it
    url = "http://"+url;
  }
  shell.openExternal(url);
}

/*---Select change
  If user changes atem type value, changes number of input selects
*/
$(document).on('change','select[name=atemtype]',function(){
   inputs = parseInt(this.value); //Gets the new atem device
   ccg_inupt = settings.get('ccg.input'); //Gets the stored input number for casparCG
   $('select[name=ccgInput]').empty(); //Emptys all options for casparCG
   for (inputCount = 1; inputCount<inputs+1; inputCount++){
     $('<option value="'+inputCount+'">'+inputCount+'</option>').appendTo('select[name=ccgInput]'); //Apends new options
   }
   $('select[name=ccgInput]').find('option[value='+ccg_inupt+']').attr('selected','selected'); //If stored value matches one of the options, selects it
});

/*---Atem state change
  Fires if the connection state is change sends the new stat to log
*/
myAtemDevice.on('connectionStateChange', function(state) {
  if (state['description'] == "connected"){
    //If the atem mixer is connected
    $("#atem_dot").removeClass().addClass("green"); //Changes the dot next to the atem logo in GUI to green
    ipcRenderer.send('asynchronous-message', "Ansluten till ATEM"); //Sends message to log
  }
  else if (state['description'] == "Not connected") {
    //If the atem mixer is not connected
    $("#atem_dot").removeClass().addClass("red"); //Changes the dot next to the atem logo in GUI to red
    ipcRenderer.send('asynchronous-message', null, "Anslutningen till ATEM förlorades"); //Sends error to log
  }
});

/*---Atem program change
  Fires if atem input is
*/
myAtemDevice.on('programBus', function(source) {
  if (run && source != lastChanged && !isFirst){
    //If program is running and the program input is not the same as before and this is not the first change
    lastChanged = source; //Sets the new input as the latest changed
    if (lastChanged == settings.get('ccg.input')){
      //If new program input is the same as casparCG Playout chanel
      sendPlayToCCG(); //Trigger play on casparCG
      ipcRenderer.send('asynchronous-message', "Playout triggad av ATEM"); //Send message to log
      playByATEM = true; //Set flag to true to tell that caspar is running
    }
    else if (playByATEM) {
      //Trigger if caspar is playing
      sendPauseToCCG(); //Pauses caspar
      nextOnList(); //Loads next mediafile on playlist
      playByATEM = false; //Set flag to false to tell that caspar is not running
    }
  }
  isFirst = 0; //This is not the first time anymore
});

/*---Atem program change
  Fires if GUI menu is clicked
*/
$("#menu").click(function () {
  if (menuStatus == "closed"){
    //If the menu is closed, displays it
    $("#menu").animate({
      left: "0px"
    }, 400);
    $("#menu p").text("<"); //Changes direction of the arrow
    menuStatus = "open"; //Sets menu stat to open
  }
  else if (menuStatus == "open"){
    //if menu is open, close it
    $("#menu").animate({
      left: "-180px"
    }, 400);
    $("#menu p").text(">"); //Changes direction of the arrow
    menuStatus = "closed"; //Sets menu stat to closed
  }
});

function isNumber(evt) {
    evt = (evt) ? evt : window.event;
    var charCode = (evt.which) ? evt.which : evt.keyCode;
    if (charCode > 31 && (charCode < 48 || charCode > 57)) {
        return false;
    }
    return true;
}

function minmax(value, min, max)
{
    var first = value.substring(0, 1);
    if(parseInt(value) < min || isNaN(parseInt(value)))
        return 0;
    else if(parseInt(value) > max)
        return 100;
    else if(first == 0 && value.length>1)
        return value.slice(-1);
    else return value;
}
