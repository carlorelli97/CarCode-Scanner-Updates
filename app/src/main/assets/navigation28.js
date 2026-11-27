// Back navigation never releases an assigned package or changes quantities.
function backRoute28(media,details,screen,lookup,packing){
 if(media)return 'media'; if(screen==='orders'&&details)return 'list';
 if(screen!=='scan')return 'home'; if(lookup&&!packing)return 'clear'; return 'exit';
}
window.handleBack28=function(){
 if(window.closeFullMedia?.())return true;
 const screen=document.querySelector('main section.active')?.id;
 const route=backRoute28(false,detailId,screen,lookupCode,packing);
 if(route==='list'){detailId=null;render();return true;}
 if(route==='home'){home25('pack');return true;}
 if(route==='clear'){lookupCode='';lookupPage=0;render();return true;}
 return false;
};
