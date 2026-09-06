'use strict';
// Adapter for the separately distributed v6 room campaign. Load after room-save.js.
if(typeof ROOM_ART!=='undefined'&&typeof roomTemplate==='function'){
  ROOM_ART.gallery=RoomVisualArt.image;
  if(typeof PAINTED_ROOM_CACHE!=='undefined')PAINTED_ROOM_CACHE.delete('gallery');
  const originalHazards=drawRoomHazards,originalForeground=drawRoomForeground,originalObstacle=drawRoomObstacle;
  let galleryFrame=false;
  drawRoomHazards=function(ctx,g){
    galleryFrame=roomTemplate(g.map.paintedRoom).scene==='gallery';
    if(galleryFrame){RoomVisualArt.ground(ctx,g.time);RoomVisualArt.flames(ctx,g.time);}
    originalHazards(ctx,g);
  };
  drawRoomForeground=function(ctx,map,part,player){
    originalForeground(ctx,map,part,player);
    if(roomTemplate(map.paintedRoom).scene==='gallery'&&part===map.roomDef.foreground.at(-1))RoomVisualArt.flames(ctx,window.game?.time||0,true);
  };
  drawRoomObstacle=function(ctx,o,player){
    if(galleryFrame&&o.kind==='column'){RoomVisualArt.columnShadow(ctx,o);RoomVisualArt.drawColumn(ctx,o,player);}
    else originalObstacle(ctx,o,player);
  };
}
