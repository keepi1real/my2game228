"""Three original articulated heroes, matching the shared 192 px hero rig style."""
from __future__ import annotations
import math
from PIL import Image
from rig import Canvas, OUTLINE, rot, step, d_up
import body as B
import tracks

BUILD = {
    'baldin': B.Build('Таррок', (185,116,79), (116,63,35), (53,68,78), (194,132,65), (58,43,38), (37,29,26), (255,191,77), hip_half=15,chest_half=13,thigh_w=26,shin_w=18,arm_w=26,fore_w=20,head_r=15),
    'mithrandir': B.Build('Элира', (124,169,178), (31,73,94), (72,43,113), (137,223,221), (29,42,69), (229,238,236), (117,250,235), hip_half=10,chest_half=5,thigh_w=17,shin_w=12,arm_w=16,fore_w=12,head_r=14),
    'peregrin': B.Build('Шелт', (194,144,113), (43,74,77), (56,45,78), (177,191,198), (43,36,42), (45,29,39), (246,173,77), hip_half=10,chest_half=5,thigh_w=18,shin_w=13,arm_w=16,fore_w=12,head_r=16),
}

def poses(hero, state):
    out=[]
    for i in range(8):
        p=math.tau*i/8; sn=math.sin(p)
        po=dict(B.BASE_POSE, grip_x=25,grip_y=81,angle=20,other_x=-10,other_y=83,cape_sway=3,phase=p,charge=0,slash=0)
        if state=='idle':
            po.update(hip_y=64+1.7*sn,lean=-3+2*sn,head=3+2*math.cos(p),grip_y=81+2*sn,other_y=83+2*sn,angle=20+4*math.sin(p+.4),cape_sway=3+3*math.sin(p+.7))
        elif state in ('walk','run'):
            run=state=='run'
            po.update(tracks._legs(p,42 if run else 27,46 if run else 27,4 if run else 2))
            po.update(lean=(17 if run else 5)+2*math.cos(p*2),head=-5 if run else 0,grip_x=24+7*sn,grip_y=81+4*math.cos(p),other_x=-8-15*sn,other_y=85-6*math.cos(p),angle=15+15*sn,cape_sway=(18 if run else 7)+5*sn)
        elif state=='attack':
            if hero=='baldin':
                po.update(tracks.knight_attack()[i]); po['angle']=po.pop('sword_ang')
                po.update(other_x=po['grip_x']-7,other_y=po['grip_y']-13,slash=[0,0,0,.4,1,.8,.3,0][i])
            elif hero=='mithrandir':
                gx=[23,14,9,25,45,48,36,25][i]; gy=[88,100,108,111,101,93,87,82][i]
                po.update(grip_x=gx,grip_y=gy,angle=20,lean=[-2,-7,-11,0,14,16,8,0][i],other_x=-15,other_y=91+8*math.sin(math.pi*i/7),charge=[.1,.3,.6,1,1,.8,.4,.1][i])
            else:
                po.update(grip_x=[23,7,-2,20,50,51,37,25][i],grip_y=[80,98,108,108,85,69,72,80][i],angle=[20,-45,-80,-10,95,125,90,30][i],lean=[0,-9,-13,3,24,28,15,0][i],hip_y=[64,65,66,62,58,57,60,64][i],other_x=[-10,-17,-23,-15,5,12,0,-10][i],other_y=[82,87,93,92,81,74,76,82][i],slash=[0,0,0,.3,1,.7,.2,0][i])
        elif state=='cast':
            k=[0,.25,.6,.9,1,.8,.35,0][i]
            po.update(grip_x=25+20*k,grip_y=81+29*k,other_x=-10+6*k,other_y=83+26*k,angle=20-42*k,lean=-3-5*k,hip_y=64-3*k,head=3-8*k,cape_sway=3+18*k,charge=k)
            po['head']+=1.5*math.sin(p+.2)
        if hero=='mithrandir':
            po['other_y']+=5
        out.append(po)
    return out

def diamond(c,center,r,col):
    c.poly([(center[0],center[1]+r),(center[0]+r*.55,center[1]),(center[0],center[1]-r),(center[0]-r*.55,center[1])],OUTLINE)
    c.poly([(center[0],center[1]+r-2),(center[0]+r*.42,center[1]),(center[0],center[1]-r+2),(center[0]-r*.42,center[1])],col)
    c.limb((center[0],center[1]+r-3),(center[0]-r*.2,center[1]),1.5,1,(235,255,249))

def face(hero):
    def fn(c,b,q,r):
        if hero=='baldin':
            # An open copper brow guard and dark buzz cut, no beard.
            c.poly([q(-r,-1),q(-r,12),q(-5,19),q(10,15),q(14,7),q(1,9),q(-6,4)],OUTLINE)
            c.poly([q(-r+2,0),q(-r+2,11),q(-5,16),q(9,13),q(12,9),q(0,11),q(-7,6)],b.metal)
            c.limb(q(-8,8),q(9,6),4,4,(240,180,98))
            c.poly([q(-14,-2),q(-9,-2),q(-7,-12),q(-13,-12)],b.metal)
        elif hero=='mithrandir':
            # Sculpted white crest plus glass temple fins.
            c.poly([q(-15,-4),q(-18,9),q(-11,20),q(5,19),q(12,12),q(-1,11),q(-7,2)],OUTLINE)
            c.poly([q(-13,-3),q(-15,8),q(-10,17),q(4,17),q(9,13),q(-3,13),q(-9,3)],b.hair)
            diamond(c,q(-14,8),12,b.accent)
            c.limb(q(-4,-3),q(8,-3),2,2,b.accent)
        else:
            # Compact masked scout, goggles and angular short hood.
            c.poly([q(-18,-7),q(-19,8),q(-10,20),q(7,19),q(17,9),q(11,6),q(2,12),q(-9,8),q(-9,-8)],OUTLINE)
            c.poly([q(-16,-6),q(-16,7),q(-9,17),q(6,17),q(14,9),q(10,8),q(2,14),q(-11,9),q(-11,-7)],b.cloth2)
            c.poly([q(-8,-4),q(15,-5),q(9,-15),q(-7,-13)],b.cloth)
            for x in (-3,9):
                c.oval(q(x,2),6,5,OUTLINE); c.oval(q(x,2),4,3,b.accent)
                c.oval(q(x-1,3),1.5,1,(255,237,174))
    return fn

def weapon(c,b,po,hero):
    g=(po['grip_x'],po['grip_y']); u=rot((0,1),-po['angle']); n=(u[1],-u[0])
    if hero=='baldin':
        top=step(g,u,43); bot=step(g,u,-23)
        c.limb(bot,top,9,8,OUTLINE); c.limb(bot,top,6,5,b.leather)
        c.limb(step(g,u,-20),step(g,u,10),2,2,b.metal)
        # Asymmetrical cleaver axe.
        pp=lambda x,y:step(step(top,u,y),n,x)
        c.poly([pp(-7,13),pp(21,17),pp(31,5),pp(28,-17),pp(11,-18),pp(-7,-4)],OUTLINE)
        c.poly([pp(-5,11),pp(20,14),pp(28,4),pp(25,-14),pp(12,-15),pp(-5,-3)],b.metal)
        c.poly([pp(20,14),pp(28,4),pp(25,-14),pp(20,-14),pp(23,3)],(245,223,180))
        c.disc(top,4,b.accent)
    elif hero=='mithrandir':
        diamond(c,step(g,(0,1),13),13,b.accent)
        for k in range(3):
            a=po['phase']+k*math.tau/3; diamond(c,(g[0]+math.cos(a)*20,g[1]+13+math.sin(a)*13),4,b.metal)
    else:
        for center,ang in ((g,po['angle']),((po['other_x'],po['other_y']),-35)):
            v=rot((0,1),-ang); side=(v[1],-v[0]); tip=step(center,v,27)
            c.limb(step(center,v,-7),step(center,v,7),7,6,OUTLINE)
            c.limb(step(center,v,-6),step(center,v,7),4,4,b.leather)
            c.poly([step(step(center,v,5),side,-4),step(step(center,v,5),side,4),tip],OUTLINE)
            c.poly([step(step(center,v,7),side,-2),step(step(center,v,7),side,2),step(tip,v,-2)],b.metal)
    return u

def draw(hero,pose):
    b=BUILD[hero]; po=dict(B.BASE_POSE,grip_x=25,grip_y=81,angle=20,other_x=-10,other_y=83,cape_sway=3,phase=0,charge=0,slash=0); po.update(pose)
    j=B.skeleton(po); B.solve_arm(j,'n',(po['grip_x'],po['grip_y']),-1); B.solve_arm(j,'f',(po['other_x'],po['other_y']),1)
    c=Canvas()
    if hero!='baldin': B.cloak(c,b,j,po,po['cape_sway'])
    B.arm(c,b,j,'f',True); B.leg(c,b,j,'f',True); B.torso(c,b,j,po); B.leg(c,b,j,'n',False)
    if hero=='baldin':
        ch=j['chest']; hp=j['hip']
        for dx in (-15,11):
            c.oval((ch[0]+dx,ch[1]),14,12,OUTLINE); c.oval((ch[0]+dx,ch[1]+1),12,10,b.metal)
            c.limb((ch[0]+dx-7,ch[1]+3),(ch[0]+dx+5,ch[1]+6),3,3,(245,180,103))
        c.poly([(ch[0]-12,ch[1]-5),(ch[0]+13,ch[1]-5),(hp[0]+14,hp[1]+10),(hp[0]-11,hp[1]+10)],b.metal)
        for dy in (10,18,26): c.limb((ch[0]-10,ch[1]-dy),(ch[0]+12,ch[1]-dy),2,2,(95,58,41))
    elif hero=='mithrandir':
        for dx in (-14,14): diamond(c,(j['chest'][0]+dx,j['chest'][1]+4),12,b.metal)
        diamond(c,(j['chest'][0]+2,j['chest'][1]-12),9,b.accent)
    else:
        c.limb((j['chest'][0]-12,j['chest'][1]+2),(j['hip'][0]+11,j['hip'][1]+8),7,7,b.leather)
        for dx in (-10,10): c.oval((j['hip'][0]+dx,j['hip'][1]-3),6,8,OUTLINE); c.oval((j['hip'][0]+dx,j['hip'][1]-2),4,6,b.cloth2)
    B.head(c,b,j,po,face(hero)); B.arm(c,b,j,'n',False)
    u=weapon(c,b,po,hero); B.fist(c,b,j,'n',u,False)
    # State-specific visible action accents remain attached to hands/weapon.
    k=po['charge']
    if k>0:
        g=(po['grip_x'],po['grip_y']+20)
        for i in range(5):
            a=po['phase']+i*math.tau/5; rr=15+15*k
            diamond(c,(g[0]+math.cos(a)*rr,g[1]+math.sin(a)*rr),3+3*k,b.accent)
        if hero=='mithrandir': diamond(c,g,10+10*k,(197,255,251))
    if po['slash']>.1:
        g=(po['grip_x'],po['grip_y']); v=rot((0,1),-po['angle']); n=(v[1],-v[0])
        for i in range(3):
            a=step(step(g,v,25+i*4),n,10+i*4); z=step(a,n,12*po['slash'])
            c.limb(a,z,2.5,1,b.accent)
    out=B.finish(c,192)
    # Each anatomy occupies a distinct silhouette while sharing the foot anchor.
    sx,sy={'baldin':(1.04,.85),'mithrandir':(.92,1.0),'peregrin':(.80,.74)}[hero]
    sized=out.resize((round(192*sx),round(192*sy)),Image.Resampling.LANCZOS)
    result=Image.new('RGBA',(192,192)); result.alpha_composite(sized,(round(88-88*sx),round(178-178*sy)))
    return result
