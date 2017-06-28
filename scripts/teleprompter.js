var teleprompterRun     = false;
var PrompterLayer       = "3-1"
function PrompterRun(OnF){
    if (OnF != "off" && !teleprompterRun && run){
        $('.btn_prompter_run').removeClass('btn_prompter_red').addClass('btn_prompter_blue');
        $('.btn_prompter').addClass('btn_prompter_blue');
        if (globalData["xkeysOn"]){
          xkeys.setRedBackLight(4, false, false);
          xkeys.setBlueBackLight(4, true, false);

          xkeys.setBlueBackLight(5, true, false);
          xkeys.setBlueBackLight(13, true, false);
          xkeys.setBlueBackLight(21, true, false);
          xkeys.setBlueBackLight(29, true, false);
        }
        ccg.loadTemplate(PrompterLayer, 'HDA_DEFAULT/TELEPROMPTER/TELEPROMPTER', 1);
        grid = {x:0.351562, y:0.694444, w:0.25, h:0.25};
        perspective = {ulx:0,uly:0,urx:-1,ury:0,lrx:-1,lry:1,llx:0, lly:1,};
        //grid = {x:-0.53125, y:0.138889, w:0.6875, h:0.6875};
						ccg.mixerFill("3-10", grid);
            ccg.mixerPerspective("3-10", perspective);
        ccg.load("3-10", sheme[listCounter].file);
        teleprompterRun = true;
    }
    else if (teleprompterRun){
      $('.btn_prompter').removeClass('btn_prompter_blue');
      ccg.clear("3");
      if (OnF != "off"){
        $('.btn_prompter_run').removeClass('btn_prompter_blue').addClass('btn_prompter_red');
        if (globalData["xkeysOn"]) xkeys.setRedBackLight(4, true, false);
      }
      if (globalData["xkeysOn"]){
        xkeys.setBlueBackLight(4, false, false);

        xkeys.setBlueBackLight(5, false, false);
        xkeys.setBlueBackLight(13, false, false);
        xkeys.setBlueBackLight(21, false, false);
        xkeys.setBlueBackLight(29, false, false);
      }
      teleprompterRun = false;
    }
}

function sendPrompterCommand(cmd) {
  if (teleprompterRun){
    if (cmd == "previous"){
      cmd = '<templateData><prompterData>prev</prompterData></templateData>';
    }
    else if (cmd == "next"){
      cmd = '<templateData><prompterData>next</prompterData></templateData>';
    }
    else if (cmd == "minus"){
      cmd = '<templateData><prompterData>slower</prompterData></templateData>';
    }
    else if (cmd == "plus"){
      cmd = '<templateData><prompterData>faster</prompterData></templateData>';
    }
    else{
      cmd = false;
    }
    if (cmd){
      ccg.updateTemplateData(PrompterLayer, cmd);
    }
  }
}
