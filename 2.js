// ДЗ2.js

// Imports.
import { getShader } from './libs/prepShader.js';
import { initShaders } from './libs/cuon-utils.js';
import * as  dat from './libs/dat.gui.module.js';
import { glMatrix, vec2, vec3, vec4, quat, mat2, mat3, mat4 } from './libs/dist/esm/index.js';
import { EventUtil } from './libs/EventUtil.js';

import { utils, Edge, Triangle } from './delaunay_utils.js';
import * as triangulation from './delaunay_triangulation.js';
import * as constraints from './closed_area.js';

async function main()
{
    // Retrieve <canvas> element
    const canvas = document.getElementById('webgl');
    canvas.width = document.documentElement.clientWidth;
    canvas.height = document.documentElement.clientHeight;

    // Get the rendering context for WebGL
    const gl = canvas.getContext('webgl2');
    if (!gl)
    {
        console.log('Failed to get the rendering context for WebGL');
        return;
    }

    // Read shaders and create shader program executable.
    const vertexShader = await getShader(gl, "vertex", "Shaders/vertexShader.glsl");
    const fragmentShader = await getShader(gl, "fragment", "Shaders/fragmentShader.glsl");

    // Initialize shaders
    if (!initShaders(gl, vertexShader, fragmentShader))
    {
        console.log('Failed to intialize shaders.');
        return;
    }

    const viewport = [0, 0, canvas.width, canvas.height];
    gl.viewport(viewport[0], viewport[1], viewport[2], viewport[3]);

    const gui = new dat.GUI();

    const guiCtrPointsParams = gui.addFolder('Control point parameters');
    const guiAreaBounds = guiCtrPointsParams.addFolder('Area Bounds');
    const guiCountControlPoints = guiCtrPointsParams.addFolder('Count control points');
    const guiSplineParams = gui.addFolder('Spline parameters');
    const guiCountSplinePoints = guiSplineParams.addFolder('Count surface spline points');

    Data.init(gl, viewport);

    canvas.onmousemove = function (ev) { mousemove(ev, canvas); };

    canvas.onmousedown = function (ev) { mousedown(ev, canvas); };

    canvas.onmouseup = function (ev) { mouseup(ev, canvas); };

    canvas.ondblclick = function (ev) { dblclick(ev, canvas); };

    (function ()
    {

        function handleMouseWheel(event)
        {
            event = EventUtil.getEvent(event);
            const delta = EventUtil.getWheelDelta(event);
            Data.mousewheel(delta);
            EventUtil.preventDefault(event);
        }

        EventUtil.addHandler(canvas, "mousewheel", handleMouseWheel);
        EventUtil.addHandler(document, "DOMMouseScroll", handleMouseWheel);

    })();

    guiAreaBounds.add(Data.controlsParameters, 'Xmin', 0, 3 * Math.PI).onChange(function (e) { Data.setDependentGeomParameters(); Data.generateControlPoints(); });
    guiAreaBounds.add(Data.controlsParameters, 'Xmax', 0, 3 * Math.PI).onChange(function (e) { Data.setDependentGeomParameters(); Data.generateControlPoints(); });
    guiAreaBounds.add(Data.controlsParameters, 'Ymin', 0, 3 * Math.PI).onChange(function (e) { Data.setDependentGeomParameters(); Data.generateControlPoints(); });
    guiAreaBounds.add(Data.controlsParameters, 'Ymax', 0, 3 * Math.PI).onChange(function (e) { Data.setDependentGeomParameters(); Data.generateControlPoints(); });
    guiAreaBounds.add(Data.controlsParameters, 'Z', 0, 5).onChange(function (e) { Data.setDependentGeomParameters(); Data.generateControlPoints(); });
    guiCountControlPoints.add(Data.controlsParameters, 'N_ctr', 2, 8, 1).onChange(function (e) { Data.generateControlPoints(); });
    guiCountControlPoints.add(Data.controlsParameters, 'M_ctr', 2, 8, 1).onChange(function (e) { Data.generateControlPoints(); });
    guiCtrPointsParams.add(Data.controlsParameters, 'showCtrPoints').onChange(function (e) { Data.setVertexBuffersAndDraw(); });
    guiCtrPointsParams.add(Data.controlsParameters, 'controlPolygon').onChange(function (e) { Data.setVertexBuffersAndDraw(); });

    guiSplineParams.add(Data.controlsParameters, 'NURBSSurface').onChange(function (e) { Data.calculateAndDraw(false); });
    guiCountSplinePoints.add(Data.controlsParameters, 'N', 2, 50, 1).onChange(function (e) { Data.calculateAndDraw(false); });
    guiCountSplinePoints.add(Data.controlsParameters, 'M', 2, 50, 1).onChange(function (e) { Data.calculateAndDraw(false); });
    guiCountSplinePoints.add(Data.controlsParameters, 'degreeU', 1, 5, 1).onChange(function (e) { Data.calculateAndDraw(true); });
    guiCountSplinePoints.add(Data.controlsParameters, 'degreeV', 1, 5, 1).onChange(function (e) { Data.calculateAndDraw(true); });
    // guiSplineParams.add(Data.controlsParameters, 'paramCoords', ["uniform", "chordal", "centripetal"]).onChange(function (e) { Data.calculateAndDraw(); });
    guiSplineParams.add(Data.controlsParameters, 'visualize', ["points", "lines", "surface"]).setValue("lines").onChange(function (e) { Data.setVertexBuffersAndDraw(); });
    guiSplineParams.add(Data.controlsParameters, 'showNormals').onChange(function (e) { Data.setVertexBuffersAndDraw(); });

    const guiTriangulation = guiSplineParams.addFolder('Triangulation');
    guiTriangulation.add(Data.controlsParameters, 'adaptDelta', 0.001, 0.01, 0.0001).onChange(function (e) { Data.calculateMeshAndDraw(); });
    guiTriangulation.add(Data.controlsParameters, 'triangleSurfaceMesh').onChange(function (e) { Data.calculateMeshAndDraw(); });
    guiTriangulation.add(Data.controlsParameters, 'triangleVisualize', ["points", "lines", "surface"]).setValue("lines").onChange(function (e) { Data.setVertexBuffersAndDraw(); });
    guiTriangulation.add(Data.controlsParameters, 'triangleMethod', ['iterative', 'dyncache']).setValue('dyncache').onChange(function (e) { Data.calculateMeshAndDraw(); });
    guiTriangulation.add(Data.controlsParameters, 'constrainedTriangulation').onChange(function (e) { Data.calculateMeshAndDraw(); });

    const guiClosedArea = guiSplineParams.addFolder('ClosedArea');
    let calcAndDrawClosedAreaFunc = (e) =>
    {
        if (Data.controlsParameters.triangleSurfaceMesh && Data.controlsParameters.closedArea) 
        {
            Data.calculateClosedArea();
        }
        Data.setVertexBuffersAndDraw();
    };
    guiClosedArea.add(Data.controlsParameters, 'closedArea').onChange(calcAndDrawClosedAreaFunc);
    guiClosedArea.add(Data, 'cleanClosedAreaAndDraw').name('closedAreaClean');
    guiClosedArea.add(Data.controlsParameters, 'closedAreaN', 10, 500, 1).onChange(calcAndDrawClosedAreaFunc);
    guiClosedArea.add(Data.controlsParameters, 'closedAreaParams', ['uniform', 'chordal', 'centripetal']).setValue('uniform').onChange(calcAndDrawClosedAreaFunc);

    // gl.depthFunc(gl.LEQUAL);
    gl.enable(gl.DEPTH_TEST);

    // Specify the color for clearing <canvas>
    gl.clearColor(0.8, 0.8, 0.8, 1.0);

    // Clear <canvas>
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

    Data.generateControlPoints();
}

function project(obj, mvpMatrix, viewport)
{
    const win = vec4.transformMat4(vec4.create(), obj, mvpMatrix);

    if (win[3] == 0.0)
        return;

    win[0] /= win[3];
    win[1] /= win[3];
    win[2] /= win[3];

    win[0] = win[0] * 0.5 + 0.5;
    win[1] = win[1] * 0.5 + 0.5;
    win[2] = win[2] * 0.5 + 0.5;

    win[0] = viewport[0] + win[0] * viewport[2];
    win[1] = viewport[1] + win[1] * viewport[3];

    return win;
}

function unproject(win, modelView, projection, viewport)
{

    const invertMV = mat4.invert(mat4.create(), modelView);
    const invertP = mat4.invert(mat4.create(), projection);

    const invertMVP = mat4.multiply(mat4.create(), invertMV, invertP);

    win[0] = (win[0] - viewport[0]) / viewport[2];
    win[1] = (win[1] - viewport[1]) / viewport[3];

    win[0] = win[0] * 2 - 1;
    win[1] = win[1] * 2 - 1;
    win[2] = win[2] * 2 - 1;

    const obj = vec4.transformMat4(vec4.create(), win, invertMVP);

    if (obj[3] == 0.0)
        return;

    obj[0] /= obj[3];
    obj[1] /= obj[3];
    obj[2] /= obj[3];

    return obj;
}

export class Point
{
    constructor(x, y, z)
    {
        this.u = 0.0;
        this.v = 0.0;

        // structured element in triangulation
        this.bStructured = false;

        this.x = x;
        this.y = y;
        this.z = z;

        this.transformMatrix = mat4.create();
        this.winx = 0.0;
        this.winz = 0.0;
        this.winy = 0.0;

        this.select = false;
    }

    toString()
    {
        return JSON.stringify({ u: this.u, v: this.v, bStructured: this.bStructured, x: this.x, y: this.y, z: this.z }, null, 2);
    }

    setPoint(x, y, z)
    {
        this.x = x;
        this.y = y;
        this.z = z;
        this.setRect();
    }
    setParams(u, v)
    {
        this.u = u;
        this.v = v;
    }
    setRect()
    {
        this.left = this.winx - 10;
        this.right = this.winx + 10;
        this.bottom = this.winy - 10;
        this.up = this.winy + 10;
    }
    calculateWindowCoordinates(mvpMatrix, viewport)
    {
        const worldCoord = vec4.fromValues(this.x, this.y, this.z, 1.0);

        //------------Get window coordinates of point-----------
        const winCoord = project(worldCoord, mvpMatrix, viewport);
        winCoord[1] = (winCoord[1]); // !!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!

        this.winx = winCoord[0];
        this.winy = winCoord[1];
        this.winz = winCoord[2];

        this.setRect();//create a bounding rectangle around point
    }
    ptInRect(x, y)
    {
        const inX = this.left <= x && x <= this.right;
        const inY = this.bottom <= y && y <= this.up;
        return inX && inY;
    }
    setTransformMatrix(T)
    {
        this.transformMatrix = T;
    }
}

const Camera = {
    d: 0.0,
    //initial distance
    d0: 0.0,
    //point the viewer is looking at
    ref: vec3.create(),
    //up vector
    up: vec4.create(),
    //view volume bounds
    xw_min: 0.0,
    xw_max: 0.0,
    yw_min: 0.0,
    yw_max: 0.0,
    d_near: 0.0,
    d_far: 0.0,
    eye: vec4.create(),
    initValues: function (angle)
    {
        const D = this.d + this.d0;

        this.eye = vec4.fromValues(0.0, 0.0, D, 0.0);
        vec4.set(this.up, 0.0, 1.0, 0.0, 0.0);

        this.xw_min = -D;
        this.xw_max = D;
        this.yw_min = -D;
        this.yw_max = D;
        this.d_near = 0.0;
        this.d_far = 2 * D;
    },
    rotateHorizontal: function (angle)
    {
        let rotMat = mat4.create();
        let resEye = vec4.create();
        mat4.fromRotation(rotMat, angle, this.up);
        vec4.transformMat4(resEye, this.eye, rotMat);
        this.eye = resEye;
        //console.log("  angle = ", angle*180/Math.PI);
    },
    rotateVertical: function (angle)
    {
        let rotMat = mat4.create();
        let resEye = vec4.create();
        const lookVec = vec3.create();
        vec3.subtract(lookVec, this.eye, this.ref);
        const axisVec = vec3.create();
        vec3.cross(axisVec, lookVec, this.up);

        mat4.fromRotation(rotMat, angle, axisVec);
        vec4.transformMat4(resEye, this.eye, rotMat);
        this.eye = resEye;
        let resUp = vec4.create();
        vec4.transformMat4(resUp, this.up, rotMat);
        this.Vx = resUp[0];
        this.Vy = resUp[1];
        this.Vz = resUp[2];
        this.up = resUp;
        //console.log("  angle = ", angle*180/Math.PI);

    },
    normalizeAngle: function (angle)
    {
        let lAngle = angle;
        while (lAngle < 0)
            lAngle += 360 * 16;
        while (lAngle > 360 * 16)
            lAngle -= 360 * 16;

        return lAngle;
    },
    getLookAt: function (zoom, x, y)
    {
        this.d = zoom;
        const transform_y = glMatrix.toRadian(y / 16.0);
        const transform_x = glMatrix.toRadian(x / 16.0);
        this.initValues();
        this.rotateVertical(transform_y);
        this.rotateHorizontal(transform_x);
        //console.log("x0 = ", this.x0, "  y0 = ", this.y0, "  z0 = ", this.z0);
        //console.log("x_ref = ", this.x_ref, "  y_ref = ", this.y_ref, "  z_ref = ", this.z_ref);
        //console.log("Vx = ", this.Vx, "  Vy = ", this.Vy, "  Vz = ", this.Vz);

        return mat4.lookAt(mat4.create(),
            this.eye,
            this.ref,
            this.up);
    },
    getProjMatrix: function ()
    {
        return mat4.ortho(mat4.create(),
            this.xw_min, this.xw_max, this.yw_min, this.yw_max, this.d_near, this.d_far);
    },
    getAxesPoints: function ()
    {
        return [0.5 * this.xw_min, 0, 0,
        this.xw_max, 0, 0,
            0, 0.5 * this.yw_min, 0,
            0, this.yw_max, 0,
            0, 0, -0.5 * (this.d_far - this.d_near) / 2.0,
            0, 0, (this.d_far - this.d_near) / 2.0];
    },
    getAxesTipLength: function ()
    {
        return 0.2 * (this.d_far - this.d_near);

    }
}

export const Data = {
    pointsCtr: [],
    weights: [],
    m10PointsCtr: [],
    m01PointsCtr: [],
    m11PointsCtr: [],
    m10Ctr: [],
    m01Ctr: [],
    m11Ctr: [],

    // Матрицы значений 2-х производных в точках
    m20Ctr: [],
    m02Ctr: [],
    m22Ctr: [],

    pointsVector10Ctr: [],
    pointsVector01Ctr: [],
    pointsVector11Ctr: [],

    pointsSpline: [],
    indicesCtr: [],
    indicesAxesTip: [],
    indicesVector10TipCtr: [],
    indicesVector01TipCtr: [],
    indicesVector11TipCtr: [],

    pointsSpline: [],
    indicesSplineLines: [],
    indicesSplineSurface: [],
    indicesNormalVectorTip: [],
    normalsSpline: [],

    countAttribData: 3 + 1 + 16, // x, y, z, sel
    verticesAxes: {},
    verticesCtr: {},
    verticesVector10Ctr: {},
    verticesVector01Ctr: {},
    verticesVector11Ctr: {},
    verticesVector10TipCtr: {},
    verticesVector01TipCtr: {},
    verticesVector11TipCtr: {},
    verticesSpline: {},
    verticesNormalVector: {},
    verticesNormalVectorTip: {},
    FSIZE: 0,
    ISIZE: 0,
    gl: null,
    vertexBufferAxes: null,
    vertexBufferAxesTip: null,
    indexBufferAxesTip: null,
    vertexBufferCtr: null,
    indexBufferCtr: null,
    vertexBufferVector10Ctr: null,
    vertexBufferVector01Ctr: null,
    vertexBufferVector11Ctr: null,
    vertexBufferVector10TipCtr: null,
    vertexBufferVector01TipCtr: null,
    vertexBufferVector11TipCtr: null,
    vertexBufferSpline: null,
    indexBufferVector10TipCtr: null,
    indexBufferVector01TipCtr: null,
    indexBufferVector11TipCtr: null,
    indexBufferSplineLines: null,
    indexBufferSplineSurface: null,
    vertexBufferNormalVector: null,
    vertexBufferNormalVectorTip: null,
    indexBufferNormalVectorTip: null,
    verticesAxesTip: {},

    a_Position: -1,
    a_select: -1,
    a_normal: -1,
    a_transformMatrix: -1,
    u_color: null,
    u_colorSelect: null,
    u_pointSize: null,
    u_pointSizeSelect: null,
    u_drawPolygon: false,
    u_useTransformMatrix: false,
    u_mvpMatrix: null,
    u_LightColor: null,
    u_LightPosition: null,
    u_AmbientLight: null,
    u_colorAmbient: null,
    u_colorSpec: null,
    u_shininess: null,
    movePoint: false,
    moveVector10: false,
    moveVector01: false,
    moveVector11: false,
    iMove: -1,
    jMove: -1,
    OldPt: null,
    OldPtm10: null,
    OldPtm01: null,
    OldPtm11: null,
    tPt: null,
    leftButtonDown: false,

    // triangulation
    vertexBufferTriangulation: null,
    indexBufferTriangulationLines: null,
    indexBufferTriangulationSurface: null,
    verticesTriangulation: {},

    delaunayTriangulation: null,
    pointsTriangulation: [], // массивы для данных триангуляции
    indicesTriangulationLines: [],
    indicesTriangulationSurface: [],
    normalsTriangulation: [],

    // closed area
    pointsCtrClosedArea: [],
    pointsClosedArea: [],

    vertexBufferClosedArea: null,
    verticesCtrClosedArea: {},
    verticesClosedArea: {},

    N_ctr: 0,
    M_ctr: 0,
    Xmid: 0.0,
    Ymid: 0.0,
    xRot: 0,
    yRot: 0,
    wheelDelta: 0.0,
    proj: mat4.create(),
    cam: mat4.create(),
    world: mat4.create(),
    viewport: [],
    lastPosX: 0,
    lastPosY: 0,
    nLongitudes: 0,
    nLatitudes: 0,
    lengthVector: 0.0,
    heighTip: 0.0,
    controlsParameters: {
        Xmin: 0.0,
        Xmax: 3 * Math.PI,
        Ymin: 0.0,
        Ymax: 3 * Math.PI,
        Z: 1.5,
        N_ctr: 4,
        M_ctr: 4,
        degreeU: 3,
        degreeV: 3,
        showCtrPoints: true,
        controlPolygon: false,
        NURBSSurface: false,
        // paramCoords: "uniform",
        visualize: "points",
        N: 8,
        M: 8,
        showNormals: false,

        // triangulation
        adaptDelta: 0.005,
        triangleSurfaceMesh: false,
        triangleVisualize: "points",
        triangleMethod: 'dyncache',
        constrainedTriangulation: false,

        // closed area
        closedArea: false,
        closedAreaN: 10,
        closedAreaParams: "uniform",
    },

    init: function (gl, viewport)
    {
        this.gl = gl;

        this.verticesAxes = new Float32Array(18); // 6 points * 3 coordinates

        // Create a buffer object
        this.vertexBufferAxes = this.gl.createBuffer();
        if (!this.vertexBufferAxes)
        {
            console.log('Failed to create the buffer object for axes');
            return -1;
        }

        this.vertexBufferAxesTip = this.gl.createBuffer();
        if (!this.vertexBufferAxesTip)
        {
            console.log('Failed to create the buffer object for axes tips');
            return -1;
        }
        // Create a buffer object
        this.vertexBufferCtr = this.gl.createBuffer();
        if (!this.vertexBufferCtr)
        {
            console.log('Failed to create the buffer object for control points');
            return -1;
        }

        this.vertexBufferVector10Ctr = this.gl.createBuffer();
        if (!this.vertexBufferVector10Ctr)
        {
            console.log('Failed to create the buffer object for vector 10');
            return -1;
        }

        this.vertexBufferVector01Ctr = this.gl.createBuffer();
        if (!this.vertexBufferVector01Ctr)
        {
            console.log('Failed to create the buffer object for vector 01');
            return -1;
        }

        this.vertexBufferVector11Ctr = this.gl.createBuffer();
        if (!this.vertexBufferVector11Ctr)
        {
            console.log('Failed to create the buffer object for vector 11');
            return -1;
        }

        this.vertexBufferVector10TipCtr = this.gl.createBuffer();
        if (!this.vertexBufferVector10TipCtr)
        {
            console.log('Failed to create the buffer object for vector 10 tips');
            return -1;
        }

        this.vertexBufferVector01TipCtr = this.gl.createBuffer();
        if (!this.vertexBufferVector01TipCtr)
        {
            console.log('Failed to create the buffer object for vector 01 tips');
            return -1;
        }

        this.vertexBufferVector11TipCtr = this.gl.createBuffer();
        if (!this.vertexBufferVector11TipCtr)
        {
            console.log('Failed to create the buffer object for vector 11 tips');
            return -1;
        }

        this.vertexBufferSpline = this.gl.createBuffer();
        if (!this.vertexBufferSpline)
        {
            console.log('Failed to create the buffer object for spline points');
            return -1;
        }

        this.indexBufferAxesTip = this.gl.createBuffer();
        if (!this.indexBufferAxesTip)
        {
            console.log('Failed to create the index object for axes tips');
            return -1;
        }

        this.indexBufferCtr = this.gl.createBuffer();
        if (!this.indexBufferCtr)
        {
            console.log('Failed to create the index object for control points');
            return -1;
        }

        this.indexBufferVector10TipCtr = this.gl.createBuffer();
        if (!this.indexBufferVector10TipCtr)
        {
            console.log('Failed to create the index object for vector 10 tips');
            return -1;
        }

        this.indexBufferVector01TipCtr = this.gl.createBuffer();
        if (!this.indexBufferVector01TipCtr)
        {
            console.log('Failed to create the index object for vector 01 tips');
            return -1;
        }

        this.indexBufferVector11TipCtr = this.gl.createBuffer();
        if (!this.indexBufferVector11TipCtr)
        {
            console.log('Failed to create the index object for vector 11 tips');
            return -1;
        }

        this.indexBufferSplineLines = this.gl.createBuffer();
        if (!this.indexBufferSplineLines)
        {
            console.log('Failed to create the index object for spline lines');
            return -1;
        }

        this.indexBufferSplineSurface = this.gl.createBuffer();
        if (!this.indexBufferSplineSurface)
        {
            console.log('Failed to create the index object for spline surface');
            return -1;
        }

        this.vertexBufferNormalVector = this.gl.createBuffer();
        if (!this.vertexBufferNormalVector)
        {
            console.log('Failed to create the buffer object for normal vector');
            return -1;
        }

        this.vertexBufferNormalVectorTip = this.gl.createBuffer();
        if (!this.vertexBufferNormalVectorTip)
        {
            console.log('Failed to create the buffer object for vector 10 tips');
            return -1;
        }

        this.indexBufferNormalVectorTip = this.gl.createBuffer();
        if (!this.indexBufferNormalVectorTip)
        {
            console.log('Failed to create the index object for normal vector tips');
            return -1;
        }

        // Triangulation
        this.vertexBufferTriangulation = this.gl.createBuffer();
        if (!this.vertexBufferTriangulation)
        {
            console.log('Failed to create the buffer object for triangulation points');
            return -1;
        }

        this.indexBufferTriangulationLines = this.gl.createBuffer();
        if (!this.indexBufferTriangulationLines)
        {
            console.log('Failed to create the index object for triangulation lines');
            return -1;
        }

        this.indexBufferTriangulationSurface = this.gl.createBuffer();
        if (!this.indexBufferTriangulationSurface)
        {
            console.log('Failed to create the index object for triangulation surface');
            return -1;
        }

        // Closed area on surface
        this.vertexBufferClosedArea = this.gl.createBuffer();
        if (!this.vertexBufferClosedArea)
        {
            console.log('Failed to create the buffer object for closed area');
            return -1;
        }

        // OpenGL attributes
        this.a_Position = this.gl.getAttribLocation(this.gl.program, 'a_Position');
        if (this.a_Position < 0)
        {
            console.log('Failed to get the storage location of a_Position');
            return -1;
        }

        this.a_select = this.gl.getAttribLocation(this.gl.program, 'a_select');
        if (this.a_select < 0)
        {
            console.log('Failed to get the storage location of a_select');
            return -1;
        }

        this.a_normal = this.gl.getAttribLocation(this.gl.program, 'a_normal');
        if (this.a_normal < 0)
        {
            console.log('Failed to get the storage location of a_normal');
            return -1;
        }

        this.a_transformMatrix = this.gl.getAttribLocation(this.gl.program, 'a_transformMatrix');
        if (this.a_transformMatrix < 0)
        {
            console.log('Failed to get the storage location of a_transformMatrix');
            return -1;
        }

        // Get the storage location of u_color
        this.u_color = this.gl.getUniformLocation(this.gl.program, 'u_color');
        if (!this.u_color)
        {
            console.log('Failed to get u_color variable');
            return;
        }

        // Get the storage location of u_colorSelect
        this.u_colorSelect = gl.getUniformLocation(this.gl.program, 'u_colorSelect');
        if (!this.u_colorSelect)
        {
            console.log('Failed to get u_colorSelect variable');
            return;
        }

        // Get the storage location of u_pointSize
        this.u_pointSize = gl.getUniformLocation(this.gl.program, 'u_pointSize');
        if (!this.u_pointSize)
        {
            console.log('Failed to get u_pointSize variable');
            return;
        }

        // Get the storage location of u_pointSize
        this.u_pointSizeSelect = gl.getUniformLocation(this.gl.program, 'u_pointSizeSelect');
        if (!this.u_pointSizeSelect)
        {
            console.log('Failed to get u_pointSizeSelect variable');
            return;
        }

        // Get the storage location of u_useTransformMatrix
        this.u_useTransformMatrix = this.gl.getUniformLocation(this.gl.program, 'u_useTransformMatrix');
        if (!this.u_useTransformMatrix)
        {
            console.log('Failed to get u_useTransformMatrix variable');
            return;
        }

        // Get the storage location of u_drawPolygon
        this.u_drawPolygon = this.gl.getUniformLocation(this.gl.program, 'u_drawPolygon');
        if (!this.u_drawPolygon)
        {
            console.log('Failed to get u_drawPolygon variable');
            return;
        }

        // Get the storage location of u_LightColor
        this.u_LightColor = gl.getUniformLocation(gl.program, 'u_LightColor');
        if (!this.u_LightColor)
        {
            console.log('Failed to get u_LightColor variable');
            return;
        }

        // Get the storage location of u_LightPosition
        this.u_LightPosition = gl.getUniformLocation(gl.program, 'u_LightPosition');
        if (!this.u_LightPosition)
        {
            console.log('Failed to get u_LightPosition variable');
            return;
        }

        // Get the storage location of u_AmbientLight
        this.u_AmbientLight = gl.getUniformLocation(gl.program, 'u_AmbientLight');
        if (!this.u_AmbientLight)
        {
            console.log('Failed to get u_AmbientLight variable');
            return;
        }

        // Get the storage location of u_colorAmbient
        this.u_colorAmbient = gl.getUniformLocation(gl.program, 'u_colorAmbient');
        if (!this.u_colorAmbient)
        {
            console.log('Failed to get u_colorAmbient variable');
            return;
        }

        // Get the storage location of u_colorSpec
        this.u_colorSpec = gl.getUniformLocation(gl.program, 'u_colorSpec');
        if (!this.u_colorSpec)
        {
            console.log('Failed to get u_colorSpec variable');
            return;
        }

        // Get the storage location of u_shininess
        this.u_shininess = gl.getUniformLocation(gl.program, 'u_shininess');
        if (!this.u_shininess)
        {
            console.log('Failed to get u_shininess variable');
            return;
        }

        this.u_mvpMatrix = gl.getUniformLocation(gl.program, 'u_mvpMatrix');
        if (!this.u_mvpMatrix)
        {
            console.log('Failed to get the storage location of u_mvpMatrix');
            return;
        }

        this.gl.uniform3f(this.u_LightColor, 1.0, 1.0, 1.0);
        // Set the ambient light
        this.gl.uniform3f(this.u_AmbientLight, 0.2, 0.2, 0.2);
        // Set the material ambient color
        this.gl.uniform3f(this.u_colorAmbient, 0.1923, 0.1923, 0.1923);
        // Set the material specular color
        this.gl.uniform3f(this.u_colorSpec, 0.5083, 0.5083, 0.5083);
        // Set the material shininess
        this.gl.uniform1f(this.u_shininess, 51);

        this.viewport = viewport;

        this.N_ctr = this.controlsParameters.N_ctr;
        this.M_ctr = this.controlsParameters.M_ctr;

        this.lengthVector = 1.0;
        this.heighTip = 0.4 * this.lengthVector;

        this.setDependentGeomParameters();

        this.OldPt = new Point(0, 0);
        this.OldPtm10 = new Point(0, 0);
        this.OldPtm01 = new Point(0, 0);
        this.OldPtm11 = new Point(0, 0);
        this.tPt = new Point(0, 0);
    },

    setDependentGeomParameters: function ()
    {
        const Xmin = this.controlsParameters.Xmin,
            Xmax = this.controlsParameters.Xmax,
            Ymin = this.controlsParameters.Ymin,
            Ymax = this.controlsParameters.Ymax,
            Z = this.controlsParameters.Z;
        this.Xmid = Xmin + (Xmax - Xmin) / 2.0;
        this.Ymid = Ymin + (Ymax - Ymin) / 2.0;

        Camera.d0 = Math.sqrt(Math.pow((Xmax - Xmin) / 2.0, 2) +
            Math.pow((Ymax - Ymin) / 2.0, 2) +
            Math.pow(Z, 2));

        this.resetCamera(false);
    },

    generateControlPoints: function ()
    {
        const Xmin = this.controlsParameters.Xmin,
            Xmax = this.controlsParameters.Xmax,
            Ymin = this.controlsParameters.Ymin,
            Ymax = this.controlsParameters.Ymax,
            Z = this.controlsParameters.Z;
        this.N_ctr = this.controlsParameters.N_ctr;
        this.M_ctr = this.controlsParameters.M_ctr;
        const n = this.N_ctr;
        const m = this.M_ctr;


        let i, j;
        let x, y, z;
        let pt;
        let vec;

        this.pointsCtr = new Array(n);
        this.m10Ctr = new Array(n);
        this.m01Ctr = new Array(n);
        this.m11Ctr = new Array(n);

        this.m20Ctr = new Array(n);
        this.m02Ctr = new Array(n);
        this.m22Ctr = new Array(n);

        this.m10PointsCtr = new Array(n);
        this.m01PointsCtr = new Array(n);
        this.m11PointsCtr = new Array(n);
        this.pointsVector10Ctr = new Array(n);
        this.pointsVector01Ctr = new Array(n);
        this.pointsVector11Ctr = new Array(n);
        for (i = 0; i < n; i++)
        {
            this.pointsCtr[i] = new Array(m);
            this.m10Ctr[i] = new Array(m);
            this.m01Ctr[i] = new Array(m);
            this.m11Ctr[i] = new Array(m);

            this.m20Ctr[i] = new Array(m);
            this.m02Ctr[i] = new Array(m);
            this.m22Ctr[i] = new Array(m);

            this.m10PointsCtr[i] = new Array(m);
            this.m01PointsCtr[i] = new Array(m);
            this.m11PointsCtr[i] = new Array(m);
            this.pointsVector10Ctr[i] = new Array(m);
            this.pointsVector01Ctr[i] = new Array(m);
            this.pointsVector11Ctr[i] = new Array(m);
            for (j = 0; j < m; j++)
            {
                this.pointsVector10Ctr[i][j] = new Array(2);
                this.pointsVector01Ctr[i][j] = new Array(2);
                this.pointsVector11Ctr[i][j] = new Array(2);
            }
        }

        this.create_coord_tip("10", this.heighTip, n, m);
        this.create_coord_tip("01", this.heighTip, n, m);
        this.create_coord_tip("11", this.heighTip, n, m);

        this.create_indexes_tip("10", n, m);
        this.create_indexes_tip("01", n, m);
        this.create_indexes_tip("11", n, m);

        for (i = 0; i < n; i++)
            for (j = 0; j < m; j++)
            {
                x = Xmin + i * (Xmax - Xmin) / (n - 1) - this.Xmid;
                y = Ymin + j * (Ymax - Ymin) / (m - 1) - this.Ymid;
                z = Z * Math.sin(x) * Math.sin(y);

                this.add_coords(i, j, x, y, z);
            }

        for (i = 0; i < n; i++)
            for (j = 0; j < m; j++)
            {

                x = 0.0;
                y = 0.0;
                z = 0.0;

                if (i == n - 1)
                {
                    x = this.pointsCtr[i][j].x - this.pointsCtr[i - 1][j].x;
                    y = this.pointsCtr[i][j].y - this.pointsCtr[i - 1][j].y;
                    z = this.pointsCtr[i][j].z - this.pointsCtr[i - 1][j].z;
                }
                if (i == 0)
                {
                    x = this.pointsCtr[i][j].x - this.pointsCtr[i + 1][j].x;
                    y = this.pointsCtr[i][j].y - this.pointsCtr[i + 1][j].y;
                    z = this.pointsCtr[i][j].z - this.pointsCtr[i + 1][j].z;
                }

                vec = vec3.normalize(vec3.create(), vec3.fromValues(x, y, z));
                vec = vec3.scale(vec, vec, this.lengthVector);

                pt = new Point(vec[0], vec[1], vec[2]);

                this.m10Ctr[i][j] = pt;

                x = 0.0;
                y = 0.0;
                z = 0.0;

                if (j == m - 1)
                {
                    x = this.pointsCtr[i][j].x - this.pointsCtr[i][j - 1].x;
                    y = this.pointsCtr[i][j].y - this.pointsCtr[i][j - 1].y;
                    z = this.pointsCtr[i][j].z - this.pointsCtr[i][j - 1].z;
                }
                if (j == 0)
                {
                    x = this.pointsCtr[i][j].x - this.pointsCtr[i][j + 1].x;
                    y = this.pointsCtr[i][j].y - this.pointsCtr[i][j + 1].y;
                    z = this.pointsCtr[i][j].z - this.pointsCtr[i][j + 1].z;
                }

                vec = vec3.normalize(vec3.create(), vec3.fromValues(x, y, z));
                vec = vec3.scale(vec, vec, this.lengthVector);

                pt = new Point(vec[0], vec[1], vec[2]);

                this.m01Ctr[i][j] = pt;
            }

        for (i = 0; i < n; i++)
            for (j = 0; j < m; j++)
            {

                x = 0.0;
                y = 0.0;
                z = 0.0;

                this.m02Ctr[i][j] = new Point(x, y, z);
                this.m20Ctr[i][j] = new Point(x, y, z);
                this.m22Ctr[i][j] = new Point(x, y, z);

                if ((j == m - 1) && ((i == 0) || (i == n - 1)))
                {
                    x = this.m10Ctr[i][j].x - this.m10Ctr[i][j - 1].x;
                    y = this.m10Ctr[i][j].y - this.m10Ctr[i][j - 1].y;
                    z = this.m10Ctr[i][j].z - this.m10Ctr[i][j - 1].z;
                }
                if ((j == 0) && ((i == 0) || (i == n - 1)))
                {
                    x = this.m10Ctr[i][j + 1].x - this.m10Ctr[i][j].x;
                    y = this.m10Ctr[i][j + 1].y - this.m10Ctr[i][j].y;
                    z = this.m10Ctr[i][j + 1].z - this.m10Ctr[i][j].z;
                }

                vec = vec3.normalize(vec3.create(), vec3.fromValues(x, y, z));
                vec = vec3.scale(vec, vec, this.lengthVector);

                pt = new Point(vec[0], vec[1], vec[2]);

                this.m11Ctr[i][j] = pt;


                x = this.pointsCtr[i][j].x + this.m10Ctr[i][j].x;
                y = this.pointsCtr[i][j].y + this.m10Ctr[i][j].y;
                z = this.pointsCtr[i][j].z + this.m10Ctr[i][j].z;
                pt = new Point(x, y, z);
                this.m10PointsCtr[i][j] = pt;

                x = this.pointsCtr[i][j].x + this.m01Ctr[i][j].x;
                y = this.pointsCtr[i][j].y + this.m01Ctr[i][j].y;
                z = this.pointsCtr[i][j].z + this.m01Ctr[i][j].z;
                pt = new Point(x, y, z);
                this.m01PointsCtr[i][j] = pt;

                x = this.pointsCtr[i][j].x + this.m11Ctr[i][j].x;
                y = this.pointsCtr[i][j].y + this.m11Ctr[i][j].y;
                z = this.pointsCtr[i][j].z + this.m11Ctr[i][j].z;
                pt = new Point(x, y, z);
                this.m11PointsCtr[i][j] = pt;

                this.setVector(this.pointsCtr[i][j].x, this.pointsCtr[i][j].y, this.pointsCtr[i][j].z,
                    this.m10PointsCtr[i][j].x, this.m10PointsCtr[i][j].y, this.m10PointsCtr[i][j].z,
                    "10", true, i, j);
                this.setVector(this.pointsCtr[i][j].x, this.pointsCtr[i][j].y, this.pointsCtr[i][j].z,
                    this.m01PointsCtr[i][j].x, this.m01PointsCtr[i][j].y, this.m01PointsCtr[i][j].z,
                    "01", true, i, j);
                this.setVector(this.pointsCtr[i][j].x, this.pointsCtr[i][j].y, this.pointsCtr[i][j].z,
                    this.m11PointsCtr[i][j].x, this.m11PointsCtr[i][j].y, this.m11PointsCtr[i][j].z,
                    "11", true, i, j);
            }

        this.add_vertices(n, m);
        this.FSIZE = this.verticesCtr.BYTES_PER_ELEMENT;

        this.createIndicesCtr(n, m);
        this.ISIZE = this.indicesCtr.BYTES_PER_ELEMENT;

        if (this.controlsParameters.NURBSSurface)
            this.calculateNURBSSurface();

        if (this.controlsParameters.triangleSurfaceMesh)
            this.calculateTriangulationMesh();

        this.setVertexBuffersAndDraw();
    },

    resetCamera: function (resetAngles)
    {
        if (resetAngles)
        {
            this.xRot = 0;
            this.yRot = 0;
        }
        this.wheelDelta = 0.0;
    },

    setLeftButtonDown: function (value)
    {
        this.leftButtonDown = value;
    },

    add_coords: function (i, j, x, y, z)
    {
        const pt = new Point(x, y, z);
        this.pointsCtr[i][j] = pt;
        this.pointsCtr[i][j].u = 0;
        this.pointsCtr[i][j].v = 0;
    },

    setAxes: function ()
    {
        this.verticesAxes.set(Camera.getAxesPoints());
    },

    create_coord_tip: function (orient, height, n, m)
    {
        let r, phi, x, y, z;
        let i, j, k, p, q;
        let countParametersOneTip;
        let count;
        let verticesVectorTipCtr;

        let pt;

        const rTop = 0;
        const rBase = 0.25 * height;
        this.nLongitudes = 36;
        this.nLatitudes = 2;

        countParametersOneTip = this.nLatitudes * this.nLongitudes * this.countAttribData;

        count = n * m * countParametersOneTip;

        switch (orient)
        {
            case "10":
                this.verticesVector10TipCtr = new Float32Array(count);
                verticesVectorTipCtr = this.verticesVector10TipCtr;
                break;
            case "01":
                this.verticesVector01TipCtr = new Float32Array(count);
                verticesVectorTipCtr = this.verticesVector01TipCtr;
                break;
            case "11":
                this.verticesVector11TipCtr = new Float32Array(count);
                verticesVectorTipCtr = this.verticesVector11TipCtr;
                break;
            case "normals":
                this.verticesNormalVectorTip = new Float32Array(count);
                verticesVectorTipCtr = this.verticesNormalVectorTip;
                break;
            case "axes":
                this.verticesAxesTip = new Float32Array(count);
                verticesVectorTipCtr = this.verticesAxesTip;
                break;
        }

        k = 0;
        for (p = 0; p < n; p++)
            for (q = 0; q < m; q++)
                for (i = 0; i < this.nLatitudes; i++)
                    for (j = 0; j < this.nLongitudes; j++)
                    {
                        r = rBase + (rTop - rBase) / (this.nLatitudes - 1) * i;
                        phi = 2 * Math.PI / this.nLongitudes * j;

                        if (((orient == "10") && ((p == 0) || (p == n - 1))) ||
                            ((orient == "01") && ((q == 0) || (q == m - 1))) ||
                            ((orient == "11") &&
                                (((p == 0) || (p == n - 1)) && ((q == 0) || (q == m - 1)))) ||
                            (orient == "normals") ||
                            ((orient == "axes") && ((p == 0) && (q == 0)))
                        )
                        {
                            x = r * Math.cos(phi);
                            y = r * Math.sin(phi);
                            z = height / (this.nLatitudes - 1) * i - height;
                        }
                        else
                        {
                            x = 0.0;
                            y = 0.0;
                            z = 0.0;
                        }

                        //pt = new Point(x, y, z);
                        //pointsVectorTipCtr[p][q][i][j] = pt;

                        //console.log("p = ", p, "  q = ", q, "  i = ", i, "  j = ", j, "  x = ", x, "  y = ", y, "  z = ", z);

                        verticesVectorTipCtr[k++] = x;
                        verticesVectorTipCtr[k++] = y;
                        verticesVectorTipCtr[k++] = z;
                        verticesVectorTipCtr[k++] = false;
                        verticesVectorTipCtr[k++] = 1.0;
                        verticesVectorTipCtr[k++] = 0.0;
                        verticesVectorTipCtr[k++] = 0.0;
                        verticesVectorTipCtr[k++] = 0.0;
                        verticesVectorTipCtr[k++] = 0.0;
                        verticesVectorTipCtr[k++] = 1.0;
                        verticesVectorTipCtr[k++] = 0.0;
                        verticesVectorTipCtr[k++] = 0.0;
                        verticesVectorTipCtr[k++] = 0.0;
                        verticesVectorTipCtr[k++] = 0.0;
                        verticesVectorTipCtr[k++] = 1.0;
                        verticesVectorTipCtr[k++] = 0.0;
                        verticesVectorTipCtr[k++] = 0.0;
                        verticesVectorTipCtr[k++] = 0.0;
                        verticesVectorTipCtr[k++] = 0.0;
                        verticesVectorTipCtr[k++] = 1.0;
                    }
    },

    create_indexes_tip: function (orient, n, m)
    {
        let i, j, k, p, q;
        let countIndicesOneTip, countPointsOneTip, disp;
        let m_countTipIndices;
        let indicesVectorCtr;

        countIndicesOneTip = (this.nLatitudes - 1) * this.nLongitudes * 2 * 3;
        countPointsOneTip = this.nLatitudes * this.nLongitudes;
        m_countTipIndices = n * m * countIndicesOneTip;

        switch (orient)
        {
            case "10":
                this.indicesVector10TipCtr = new Uint16Array(m_countTipIndices);
                indicesVectorCtr = this.indicesVector10TipCtr;
                break;
            case "01":
                this.indicesVector01TipCtr = new Uint16Array(m_countTipIndices);
                indicesVectorCtr = this.indicesVector01TipCtr;
                break;
            case "11":
                this.indicesVector11TipCtr = new Uint16Array(m_countTipIndices);
                indicesVectorCtr = this.indicesVector11TipCtr;
                break;
            case "normals":
                this.indicesNormalVectorTip = new Uint16Array(m_countTipIndices);
                indicesVectorCtr = this.indicesNormalVectorTip;
                break;
            case "axes":
                this.indicesAxesTip = new Uint16Array(m_countTipIndices);
                indicesVectorCtr = this.indicesAxesTip;
                break;
        }

        k = 0;
        for (p = 0; p < n; p++)
            for (q = 0; q < m; q++)
            {
                disp = (p * m + q) * countPointsOneTip;
                for (i = 0; i < this.nLatitudes - 1; i++)
                    for (j = 0; j < this.nLongitudes; j++)
                    {
                        if (j != this.nLongitudes - 1)
                        {
                            indicesVectorCtr[k++] = disp + this.nLongitudes * i + j;
                            indicesVectorCtr[k++] = disp + this.nLongitudes * i + j + 1;
                            indicesVectorCtr[k++] = disp + this.nLongitudes * (i + 1) + j + 1;

                            indicesVectorCtr[k++] = disp + this.nLongitudes * (i + 1) + j + 1;
                            indicesVectorCtr[k++] = disp + this.nLongitudes * (i + 1) + j;
                            indicesVectorCtr[k++] = disp + this.nLongitudes * i + j;
                        }
                        else
                        {
                            indicesVectorCtr[k++] = disp + this.nLongitudes * i + j;
                            indicesVectorCtr[k++] = disp + this.nLongitudes * i;
                            indicesVectorCtr[k++] = disp + this.nLongitudes * (i + 1);

                            indicesVectorCtr[k++] = disp + this.nLongitudes * (i + 1);
                            indicesVectorCtr[k++] = disp + this.nLongitudes * (i + 1) + j;
                            indicesVectorCtr[k++] = disp + this.nLongitudes * i + j;
                        }
                    }
            }
    },

    setVector: function (x1, y1, z1, x2, y2, z2, orient, create, i, j)
    {
        let pt;
        let ptm;

        //let rBase;
        //let length;

        //let ux, uy, vx, vy, norm;

        let pointsVectorCtr;
        //let pointsVectorTipCtr;
        let verticesVectorTipCtr;
        let number;

        if (orient == "normal")
            number = i * this.controlsParameters.M + j;
        else
            number = i * this.controlsParameters.M_ctr + j;

        switch (orient)
        {
            case "10":
                pointsVectorCtr = this.pointsVector10Ctr;
                //pointsVectorTipCtr = this.pointsVector10TipCtr;
                verticesVectorTipCtr = this.verticesVector10TipCtr;
                break;
            case "01":
                pointsVectorCtr = this.pointsVector01Ctr;
                //pointsVectorTipCtr = this.pointsVector01TipCtr;
                verticesVectorTipCtr = this.verticesVector01TipCtr;
                break;
            case "11":
                pointsVectorCtr = this.pointsVector11Ctr;
                //pointsVectorTipCtr = this.pointsVector11TipCtr;
                verticesVectorTipCtr = this.verticesVector11TipCtr;
                break;
            case "normal":
                verticesVectorTipCtr = this.verticesNormalVectorTip;
                break;
        }

        if (orient != "normal")
        {
            if (create) //create mode
            {
                pt = new Point(x1, y1, z1);
                ptm = new Point(x2, y2, z2);

                //console.log("i = ", i, "  j = ", j);
                pointsVectorCtr[i][j][0] = pt;
                pointsVectorCtr[i][j][1] = ptm;
            }
            else //update mode
            {
                pointsVectorCtr[i][j][0].setPoint(x1, y1, z1);
                pointsVectorCtr[i][j][1].setPoint(x2, y2, z2);
            }
        }

        const vec = vec3.normalize(vec3.create(), vec3.fromValues(x2 - x1, y2 - y1, z2 - z1));
        const q = quat.rotationTo(quat.create(), [0.0, 0.0, 1.0], vec);
        const rotateMatrix = mat4.fromQuat(mat4.create(), q);

        const translateMatrix = mat4.fromTranslation(mat4.create(), vec3.fromValues(x2, y2, z2));

        const transformMatrix = mat4.mul(mat4.create(), translateMatrix, rotateMatrix);

        this.setTransformMatrix(verticesVectorTipCtr, transformMatrix, number);

        if ((orient != "normal") && (!create)) //update mode
            this.updateVerticesVectorCtr(orient, i, j)
    },

    setSelectVector: function (orient, select, i, j)
    {
        let pointsVectorCtr;

        switch (orient)
        {
            case "10":
                pointsVectorCtr = this.pointsVector10Ctr;
                break;
            case "01":
                pointsVectorCtr = this.pointsVector01Ctr;
                break;
            case "11":
                pointsVectorCtr = this.pointsVector11Ctr;
                break;
        }

        pointsVectorCtr[i][j][0].select = select;
        pointsVectorCtr[i][j][1].select = select;
        //this.pointsVectorTipCtr[3 * i].select = select;
        //this.pointsVectorTipCtr[3 * i + 1].select = select;
        //this.pointsVectorTipCtr[3 * i + 2].select = select;

        this.updateVerticesVectorCtr(orient, i, j);
    },

    updateVerticesVectorCtr: function (orient, i, j)
    {
        let pointsVectorCtr;
        let verticesVectorCtr;
        let verticesVectorTipCtr;

        switch (orient)
        {
            case "10":
                pointsVectorCtr = this.pointsVector10Ctr;
                verticesVectorCtr = this.verticesVector10Ctr;
                verticesVectorTipCtr = this.verticesVector10TipCtr;
                break;
            case "01":
                pointsVectorCtr = this.pointsVector01Ctr;
                verticesVectorCtr = this.verticesVector01Ctr;
                verticesVectorTipCtr = this.verticesVector01TipCtr;
                break;
            case "11":
                pointsVectorCtr = this.pointsVector11Ctr;
                verticesVectorCtr = this.verticesVector11Ctr;
                verticesVectorTipCtr = this.verticesVector11TipCtr;
                break;
        }

        const number = i * this.M_ctr + j;

        verticesVectorCtr[2 * number * this.countAttribData] = pointsVectorCtr[i][j][0].x;
        verticesVectorCtr[2 * number * this.countAttribData + 1] = pointsVectorCtr[i][j][0].y;
        verticesVectorCtr[2 * number * this.countAttribData + 2] = pointsVectorCtr[i][j][0].z;
        verticesVectorCtr[2 * number * this.countAttribData + 3] = pointsVectorCtr[i][j][0].select;
        verticesVectorCtr[(2 * number + 1) * this.countAttribData] = pointsVectorCtr[i][j][1].x;
        verticesVectorCtr[(2 * number + 1) * this.countAttribData + 1] = pointsVectorCtr[i][j][1].y;
        verticesVectorCtr[(2 * number + 1) * this.countAttribData + 2] = pointsVectorCtr[i][j][1].z;
        verticesVectorCtr[(2 * number + 1) * this.countAttribData + 3] = pointsVectorCtr[i][j][1].select;

        const countParametersOneTip = this.nLatitudes * this.nLongitudes * this.countAttribData;
        const disp = number * countParametersOneTip;

        for (let l = 0; l < this.nLatitudes; l++)
            for (let k = 0; k < this.nLongitudes; k++)
                verticesVectorTipCtr[disp + (l * this.nLongitudes + k) * this.countAttribData + 3] = pointsVectorCtr[i][j][1].select;
    },

    setTransformMatrix: function (verticesVectorTip, transformMatrix, i)
    {
        const countParametersOneTip = this.nLatitudes * this.nLongitudes * this.countAttribData;
        const disp = i * countParametersOneTip;

        for (let j = 0; j < this.nLatitudes; j++)
            for (let k = 0; k < this.nLongitudes; k++)
                for (let l = 0; l < 16; l++)
                {
                    verticesVectorTip[disp + (j * this.nLongitudes + k) * this.countAttribData + 4 + l] = transformMatrix[l];
                }
    },

    createIndicesCtr: function (n, m)
    {
        let i, j, k = 0;
        this.indicesCtr = new Uint16Array(2 * n * m);

        for (i = 0; i < n; i++)
            for (j = 0; j < m; j++)
                this.indicesCtr[k++] = i * m + j;
        for (j = 0; j < m; j++)
            for (i = 0; i < n; i++)
                this.indicesCtr[k++] = i * m + j;
    },

    createIndicesSplineLines: function (n, m)
    {
        let i, j, k = 0;
        this.indicesSplineLines = new Uint16Array(2 * n * m);

        for (i = 0; i < n; i++)
        {
            for (j = 0; j < m; j++)
                this.indicesSplineLines[k++] = i * m + j;
        }
        for (j = 0; j < m; j++)
        {
            for (i = 0; i < n; i++)
                this.indicesSplineLines[k++] = i * m + j;
        }
    },

    createIndicesSplineSurface: function (n, m)
    {
        let k = 0;
        this.indicesSplineSurface = new Uint16Array(6 * (n - 1) * (m - 1));

        for (let i = 0; i < n - 1; i++)
            for (let j = 0; j < m - 1; j++)
            {
                this.indicesSplineSurface[k++] = i * m + j;
                this.indicesSplineSurface[k++] = (i + 1) * m + j;
                this.indicesSplineSurface[k++] = i * m + j + 1;
                this.indicesSplineSurface[k++] = i * m + j + 1;
                this.indicesSplineSurface[k++] = (i + 1) * m + j;
                this.indicesSplineSurface[k++] = (i + 1) * m + j + 1;
            }
    },

    setXRotation: function (angle)
    {
        const lAngle = Camera.normalizeAngle(angle);
        if (lAngle != this.xRot)
        {
            this.xRot = lAngle;
        }
    },

    setYRotation: function (angle)
    {
        const lAngle = Camera.normalizeAngle(angle);
        if (lAngle != this.yRot)
        {
            this.yRot = lAngle;
        }
    },

    mousemoveHandler: function (x, y)
    {
        if (this.leftButtonDown)
        {
            if (this.movePoint /*|| this.moveVector10 || this.moveVector01 || this.moveVector11*/)
            {

                const offset = this.iMove * this.M_ctr + this.jMove;

                const winCoord = vec4.create();

                winCoord[0] = x;
                winCoord[1] = y;
                if (this.movePoint)
                {
                    winCoord[2] = this.pointsCtr[this.iMove][this.jMove].winz;
                }
                winCoord[3] = 1.0;

                const mvMatr = mat4.mul(mat4.create(), this.cam, this.world);

                const worldCoord = unproject(winCoord, mvMatr, this.proj, this.viewport);

                if (this.movePoint)
                {
                    this.pointsCtr[this.iMove][this.jMove].x = worldCoord[0];
                    this.pointsCtr[this.iMove][this.jMove].y = worldCoord[1];
                    this.pointsCtr[this.iMove][this.jMove].z = worldCoord[2];

                    this.verticesCtr[offset * 4] = this.pointsCtr[this.iMove][this.jMove].x;
                    this.verticesCtr[offset * 4 + 1] = this.pointsCtr[this.iMove][this.jMove].y;
                    this.verticesCtr[offset * 4 + 2] = this.pointsCtr[this.iMove][this.jMove].z;

                    this.tPt.x = this.pointsCtr[this.iMove][this.jMove].x - this.OldPt.x;
                    this.tPt.y = this.pointsCtr[this.iMove][this.jMove].y - this.OldPt.y;
                    this.tPt.z = this.pointsCtr[this.iMove][this.jMove].z - this.OldPt.z;

                    this.m10PointsCtr[this.iMove][this.jMove].x = this.OldPtm10.x + this.tPt.x;
                    this.m10PointsCtr[this.iMove][this.jMove].y = this.OldPtm10.y + this.tPt.y;
                    this.m10PointsCtr[this.iMove][this.jMove].z = this.OldPtm10.z + this.tPt.z;

                    this.m01PointsCtr[this.iMove][this.jMove].x = this.OldPtm01.x + this.tPt.x;
                    this.m01PointsCtr[this.iMove][this.jMove].y = this.OldPtm01.y + this.tPt.y;
                    this.m01PointsCtr[this.iMove][this.jMove].z = this.OldPtm01.z + this.tPt.z;

                    this.m11PointsCtr[this.iMove][this.jMove].x = this.OldPtm11.x + this.tPt.x;
                    this.m11PointsCtr[this.iMove][this.jMove].y = this.OldPtm11.y + this.tPt.y;
                    this.m11PointsCtr[this.iMove][this.jMove].z = this.OldPtm11.z + this.tPt.z;

                    this.setVector(this.pointsCtr[this.iMove][this.jMove].x,
                        this.pointsCtr[this.iMove][this.jMove].y,
                        this.pointsCtr[this.iMove][this.jMove].z,
                        this.m10PointsCtr[this.iMove][this.jMove].x,
                        this.m10PointsCtr[this.iMove][this.jMove].y,
                        this.m10PointsCtr[this.iMove][this.jMove].z, "10", false,
                        this.iMove, this.jMove);

                    this.setVector(this.pointsCtr[this.iMove][this.jMove].x,
                        this.pointsCtr[this.iMove][this.jMove].y,
                        this.pointsCtr[this.iMove][this.jMove].z,
                        this.m01PointsCtr[this.iMove][this.jMove].x,
                        this.m01PointsCtr[this.iMove][this.jMove].y,
                        this.m01PointsCtr[this.iMove][this.jMove].z, "01", false,
                        this.iMove, this.jMove);

                    this.setVector(this.pointsCtr[this.iMove][this.jMove].x,
                        this.pointsCtr[this.iMove][this.jMove].y,
                        this.pointsCtr[this.iMove][this.jMove].z,
                        this.m11PointsCtr[this.iMove][this.jMove].x,
                        this.m11PointsCtr[this.iMove][this.jMove].y,
                        this.m11PointsCtr[this.iMove][this.jMove].z, "11", false,
                        this.iMove, this.jMove);
                }

                if (this.controlsParameters.NURBSSurface)
                {
                    this.calculateNURBSSurface();
                }

                if (this.controlsParameters.triangleSurfaceMesh)
                {
                    this.calculateTriangulationMesh();
                }

                if (this.controlsParameters.closedArea)
                {
                    this.calculateClosedArea();

                    if (this.controlsParameters.constrainedTriangulation)
                    {
                        this.calculateConstrainedTriangulation();
                    }
                }
            }
            else
            {
                const dx = x - this.lastPosX;
                const dy = y - this.lastPosY;

                this.setXRotation(this.xRot - 8 * dx);
                this.setYRotation(this.yRot - 8 * dy);

                this.lastPosX = x;
                this.lastPosY = y;
            }
            this.setVertexBuffersAndDraw();
        }
        else
        {
            for (let i = 0; i < this.N_ctr; i++)
            {
                for (let j = 0; j < this.M_ctr; j++)
                {
                    this.pointsCtr[i][j].select = false;

                    if (this.pointsCtr[i][j].ptInRect(x, y))
                        this.pointsCtr[i][j].select = true;

                    this.verticesCtr[(i * this.M_ctr + j) * 4 + 3] = this.pointsCtr[i][j].select;
                }
            }

            this.setVertexBuffersAndDraw();
        }
    },

    mousedownHandler: function (button, x, y)
    {
        switch (button)
        {
            case 0: //left button
                this.movePoint = false;
                this.moveVector10 = false;
                this.moveVector01 = false;
                this.moveVector11 = false;

                for (let i = 0; i < this.N_ctr; i++)
                    for (let j = 0; j < this.M_ctr; j++)
                    {
                        if (this.pointsCtr[i][j].select == true)
                        {
                            this.movePoint = true;
                            this.iMove = i;
                            this.jMove = j;

                            this.OldPt.setPoint(this.pointsCtr[i][j].x, this.pointsCtr[i][j].y, this.pointsCtr[i][j].z);
                        }
                    }

                if (!this.movePoint /*&& !this.moveVector10 && !this.moveVector01 && !this.moveVector11*/)
                {
                    this.lastPosX = x;
                    this.lastPosY = y;
                }

                this.setLeftButtonDown(true);
                break;
            case 2: //right button
                this.resetCamera();
                this.setVertexBuffersAndDraw();
                break;
        }
    },

    mouseupHandler: function (button, x, y)
    {
        if (button == 0) //left button
            this.setLeftButtonDown(false);
    },

    dblClickHandler: function (x, y)
    {
        if (!this.controlsParameters.triangleSurfaceMesh)
        {
            return;
        }

        let bIsDeleted = false;

        // try to delete selected points first
        for (let i = 0; i < this.pointsCtrClosedArea.length; ++i)
        {
            if (this.pointsCtrClosedArea[i].ptInRect(x, y))
            {
                // unselect triangulation point (if exist)
                for (let j = 0; j < this.pointsTriangulation.length; ++j)
                {
                    if (this.pointsTriangulation[j].ptInRect(x, y))
                    {
                        this.pointsTriangulation[j].select = false;
                        this.verticesTriangulation[7 * j + 3] = false;
                        break;
                    }
                }

                bIsDeleted = true;
                this.pointsCtrClosedArea.splice(i, 1);
                break;
            }
        }

        // if no one is deleted then select
        if (!bIsDeleted)
        {
            for (let i = 0; i < this.pointsTriangulation.length; ++i)
            {
                let trigPoint = this.pointsTriangulation[i];
                if (!trigPoint.select)
                {
                    trigPoint.select = trigPoint.ptInRect(x, y);
                    this.verticesTriangulation[i * 7 + 3] = trigPoint.select;

                    if (trigPoint.select)
                    {
                        trigPoint.bStructured = true;

                        let newPoint = new Point(trigPoint.x, trigPoint.y, trigPoint.z);
                        newPoint.u = trigPoint.u;
                        newPoint.v = trigPoint.v;
                        newPoint.bStructured = true;

                        this.pointsCtrClosedArea.push(newPoint);
                        break;
                    }
                }
            }
        }

        if (this.controlsParameters.closedArea)
        {
            this.calculateClosedArea();
        }

        this.setVertexBuffersAndDraw();
    },

    mousewheel: function (delta)
    {
        const d = Camera.d0 * (-1.) * delta / 1000.0;
        if ((this.wheelDelta + d >= -Camera.d0) && (this.wheelDelta + d <= Camera.d0 * 3.0))
            this.wheelDelta += d;

        this.setVertexBuffersAndDraw();
    },

    add_vertices: function (n, m)
    {
        const totalLength = n * m;

        this.verticesCtr = new Float32Array(totalLength * 4);
        this.verticesVector10Ctr = new Float32Array(2 * totalLength * this.countAttribData);
        this.verticesVector01Ctr = new Float32Array(2 * totalLength * this.countAttribData);
        this.verticesVector11Ctr = new Float32Array(2 * totalLength * this.countAttribData);
        for (let i = 0; i < n; i++)
            for (let j = 0; j < m; j++)
            {
                const offset = i * m + j;
                this.verticesCtr[offset * 4] = this.pointsCtr[i][j].x;
                this.verticesCtr[offset * 4 + 1] = this.pointsCtr[i][j].y;
                this.verticesCtr[offset * 4 + 2] = this.pointsCtr[i][j].z;
                this.verticesCtr[offset * 4 + 3] = this.pointsCtr[i][j].select;
                for (let k = 0; k < 16; k++)
                {
                    //    this.verticesCtr[(i * m + j) * this.countAttribData + 4 + k] = this.pointsCtr[i][j].transformMatrix[k];

                    //console.log("i = ", i, "  j = ", j);
                    this.verticesVector10Ctr[2 * offset * this.countAttribData + 4 + k] = this.pointsVector10Ctr[i][j][0].transformMatrix[k];
                    this.verticesVector10Ctr[(2 * offset + 1) * this.countAttribData + 4 + k] = this.pointsVector10Ctr[i][j][1].transformMatrix[k];

                    this.verticesVector01Ctr[2 * offset * this.countAttribData + 4 + k] = this.pointsVector01Ctr[i][j][0].transformMatrix[k];
                    this.verticesVector01Ctr[(2 * offset + 1) * this.countAttribData + 4 + k] = this.pointsVector01Ctr[i][j][1].transformMatrix[k];

                    this.verticesVector11Ctr[2 * offset * this.countAttribData + 4 + k] = this.pointsVector11Ctr[i][j][0].transformMatrix[k];
                    this.verticesVector11Ctr[(2 * offset + 1) * this.countAttribData + 4 + k] = this.pointsVector11Ctr[i][j][1].transformMatrix[k];
                }

                this.updateVerticesVectorCtr("10", i, j);
                this.updateVerticesVectorCtr("01", i, j);
                this.updateVerticesVectorCtr("11", i, j);
            }
    },

    setVertexBuffersAndDraw: function ()
    {
        let i, j;
        let q, rotateMatrix, translateMatrix, transformMatrix, axesTransformMatrix;

        this.cam = Camera.getLookAt(this.wheelDelta, this.xRot, this.yRot);
        this.proj = Camera.getProjMatrix();

        this.gl.uniform4f(this.u_LightPosition, Camera.eye[0], Camera.eye[1], Camera.eye[2], 1.0);

        this.gl.uniform1f(this.u_useTransformMatrix, false);
        this.gl.uniform1f(this.u_drawPolygon, false);

        // Clear <canvas>
        this.gl.clear(this.gl.COLOR_BUFFER_BIT | this.gl.DEPTH_BUFFER_BIT);

        this.setAxes();
        this.create_coord_tip("axes", Camera.getAxesTipLength(), 1, 1);
        this.create_indexes_tip("axes", 1, 1);

        // Bind the buffer object to target
        this.gl.bindBuffer(this.gl.ARRAY_BUFFER, this.vertexBufferAxes);
        // Write date into the buffer object
        this.gl.bufferData(this.gl.ARRAY_BUFFER, this.verticesAxes, this.gl.DYNAMIC_DRAW);
        // Assign the buffer object to a_Position variable
        this.gl.vertexAttribPointer(this.a_Position, 3, this.gl.FLOAT, false, 0, 0);
        // Enable the assignment to a_Position variable
        this.gl.enableVertexAttribArray(this.a_Position);
        // Disable the assignment to a_select variable
        this.gl.disableVertexAttribArray(this.a_select);
        // Disable the assignment to a_normal variable
        this.gl.disableVertexAttribArray(this.a_normal);
        this.gl.disableVertexAttribArray(this.a_transformMatrix);
        this.gl.disableVertexAttribArray(this.a_transformMatrix + 1);
        this.gl.disableVertexAttribArray(this.a_transformMatrix + 2);
        this.gl.disableVertexAttribArray(this.a_transformMatrix + 3);

        const axes_scale = 0.1;
        const half_axes_scale_length = 1.5 * (this.verticesAxes[17] - this.verticesAxes[14]) * axes_scale / 2;
        const scaleMatrix = mat4.fromScaling(mat4.create(), [axes_scale, axes_scale, axes_scale]);
        translateMatrix = mat4.fromTranslation(mat4.create(), vec3.fromValues(this.verticesAxes[3] - half_axes_scale_length, //x_max - half_axes_scale_length
            -this.verticesAxes[10] + half_axes_scale_length, //-y_max + half_axes_scale_length 
            this.verticesAxes[17] - half_axes_scale_length)); //z_max - half_axes_scale_length 
        transformMatrix = mat4.mul(mat4.create(), scaleMatrix, this.world);
        transformMatrix = mat4.mul(mat4.create(), this.cam, transformMatrix);
        transformMatrix = mat4.mul(mat4.create(), translateMatrix, transformMatrix);
        transformMatrix = mat4.mul(mat4.create(), this.proj, transformMatrix);
        this.gl.uniformMatrix4fv(this.u_mvpMatrix, false, transformMatrix);

        // Draw
        this.gl.uniform4f(this.u_color, 1.0, 0.0, 0.0, 1.0);
        this.gl.drawArrays(this.gl.LINES, 0, 2);
        this.gl.uniform4f(this.u_color, 0.0, 1.0, 0.0, 1.0);
        this.gl.drawArrays(this.gl.LINES, 2, 2);
        this.gl.uniform4f(this.u_color, 0.0, 0.0, 1.0, 1.0);
        this.gl.drawArrays(this.gl.LINES, 4, 2);

        const countTipIndices = (this.nLatitudes - 1) * this.nLongitudes * 2 * 3;
        // Bind the buffer object to target
        this.gl.bindBuffer(this.gl.ARRAY_BUFFER, this.vertexBufferAxesTip);
        // Write date into the buffer object
        this.gl.bufferData(this.gl.ARRAY_BUFFER, this.verticesAxesTip, this.gl.DYNAMIC_DRAW);
        this.gl.bindBuffer(this.gl.ELEMENT_ARRAY_BUFFER, this.indexBufferAxesTip);
        this.gl.bufferData(this.gl.ELEMENT_ARRAY_BUFFER, this.indicesAxesTip, this.gl.DYNAMIC_DRAW);
        // Assign the buffer object to a_Position variable
        this.gl.vertexAttribPointer(this.a_Position, 3, this.gl.FLOAT, false, this.FSIZE * this.countAttribData, 0);
        // Enable the assignment to a_Position variable
        this.gl.enableVertexAttribArray(this.a_Position);
        // Disable the assignment to a_select variable
        this.gl.disableVertexAttribArray(this.a_select);
        // Disable the assignment to a_normal variable
        this.gl.disableVertexAttribArray(this.a_normal);
        this.gl.disableVertexAttribArray(this.a_transformMatrix);
        this.gl.disableVertexAttribArray(this.a_transformMatrix + 1);
        this.gl.disableVertexAttribArray(this.a_transformMatrix + 2);
        this.gl.disableVertexAttribArray(this.a_transformMatrix + 3);
        this.gl.uniform4f(this.u_color, 0.0, 0.0, 0.0, 1.0);

        for (i = 0; i < 3; i++)
        {
            switch (i)
            {
                case 0:
                    q = quat.rotationTo(quat.create(), [0.0, 0.0, 1.0], [1.0, 0.0, 0.0]);
                    translateMatrix = mat4.fromTranslation(mat4.create(), vec3.fromValues(this.verticesAxes[3], this.verticesAxes[4], this.verticesAxes[5])); //x_max
                    break;
                case 1:
                    q = quat.rotationTo(quat.create(), [0.0, 0.0, 1.0], [0.0, 1.0, 0.0]);
                    translateMatrix = mat4.fromTranslation(mat4.create(), vec3.fromValues(this.verticesAxes[9], this.verticesAxes[10], this.verticesAxes[11])); //y_max
                    break;
                case 2:
                    q = quat.rotationTo(quat.create(), [0.0, 0.0, 1.0], [0.0, 0.0, 1.0]);
                    translateMatrix = mat4.fromTranslation(mat4.create(), vec3.fromValues(this.verticesAxes[15], this.verticesAxes[16], this.verticesAxes[17])); //z_max
                    break;
            }
            rotateMatrix = mat4.fromQuat(mat4.create(), q);
            axesTransformMatrix = mat4.mul(mat4.create(), translateMatrix, rotateMatrix);
            axesTransformMatrix = mat4.mul(mat4.create(), transformMatrix, axesTransformMatrix);
            this.gl.uniformMatrix4fv(this.u_mvpMatrix, false, axesTransformMatrix);
            this.gl.drawElements(this.gl.TRIANGLES, countTipIndices, this.gl.UNSIGNED_SHORT, 0);

        }

        const mvMatr = mat4.mul(mat4.create(), this.cam, this.world);
        const mvpMatr = mat4.mul(mat4.create(), this.proj, mvMatr);

        this.gl.uniformMatrix4fv(this.u_mvpMatrix, false, mvpMatr);

        // Bind the buffer object to target
        this.gl.bindBuffer(this.gl.ARRAY_BUFFER, this.vertexBufferCtr);
        // Write date into the buffer object
        this.gl.bufferData(this.gl.ARRAY_BUFFER, this.verticesCtr, this.gl.DYNAMIC_DRAW);
        // Assign the buffer object to a_Position variable
        this.gl.vertexAttribPointer(this.a_Position, 3, this.gl.FLOAT, false, this.FSIZE * 4, 0);
        // Enable the assignment to a_Position variable
        this.gl.enableVertexAttribArray(this.a_Position);
        // Assign the buffer object to a_select variable
        this.gl.vertexAttribPointer(this.a_select, 1, this.gl.FLOAT, false, this.FSIZE * 4, this.FSIZE * 3);
        // Enable the assignment to a_select variable
        this.gl.enableVertexAttribArray(this.a_select);
        // Disable the assignment to a_normal variable
        this.gl.disableVertexAttribArray(this.a_normal);
        // Disable the assignment to a_transformMatrix variable
        this.gl.disableVertexAttribArray(this.a_transformMatrix);
        this.gl.disableVertexAttribArray(this.a_transformMatrix + 1);
        this.gl.disableVertexAttribArray(this.a_transformMatrix + 2);
        this.gl.disableVertexAttribArray(this.a_transformMatrix + 3);

        this.gl.uniform4f(this.u_color, 0.0, 0.0, 0.0, 1.0);
        this.gl.uniform4f(this.u_colorSelect, 0.5, 0.5, 0.0, 1.0);
        this.gl.uniform1f(this.u_pointSize, 7.0);
        this.gl.uniform1f(this.u_pointSizeSelect, 10.0);

        for (i = 0; i < this.N_ctr; i++)
            for (j = 0; j < this.M_ctr; j++)
            {
                this.pointsCtr[i][j].calculateWindowCoordinates(mvpMatr, this.viewport);
                //console.log("i = ", i, "  j = ", j, "  winx = ", this.pointsCtr[i][j].winx, "  winy = ", this.pointsCtr[i][j].winy, "  winz = ", this.pointsCtr[i][j].winz);
                if ((i == 0) || (i == this.N_ctr - 1))
                    this.m10PointsCtr[i][j].calculateWindowCoordinates(mvpMatr, this.viewport);
                if ((j == 0) || (j == this.M_ctr - 1))
                    this.m01PointsCtr[i][j].calculateWindowCoordinates(mvpMatr, this.viewport);
                if (((i == 0) || (i == this.N_ctr - 1)) && ((j == 0) || (j == this.M_ctr - 1)))
                    this.m11PointsCtr[i][j].calculateWindowCoordinates(mvpMatr, this.viewport);
            }

        // Draw
        if (this.controlsParameters.showCtrPoints)
            this.gl.drawArrays(this.gl.POINTS, 0, this.N_ctr * this.M_ctr);
        if (this.controlsParameters.controlPolygon)
        {
            this.gl.bindBuffer(this.gl.ELEMENT_ARRAY_BUFFER, this.indexBufferCtr);
            this.gl.bufferData(this.gl.ELEMENT_ARRAY_BUFFER, this.indicesCtr, this.gl.DYNAMIC_DRAW);

            this.gl.uniform4f(this.u_color, 0.0, 1.0, 0.0, 1.0);
            this.gl.uniform4f(this.u_colorSelect, 0.0, 1.0, 0.0, 1.0);

            for (i = 0; i < this.N_ctr; i++)
                this.gl.drawElements(this.gl.LINE_STRIP, this.M_ctr, this.gl.UNSIGNED_SHORT, ((i * this.M_ctr) * this.ISIZE));

            this.gl.uniform4f(this.u_color, 0.0, 0.0, 1.0, 1.0);
            this.gl.uniform4f(this.u_colorSelect, 0.0, 0.0, 1.0, 1.0);

            for (j = 0; j < this.M_ctr; j++)
                this.gl.drawElements(this.gl.LINE_STRIP, this.N_ctr, this.gl.UNSIGNED_SHORT, ((this.N_ctr * this.M_ctr + j * this.N_ctr) * this.ISIZE));
        }

        this.gl.uniform1f(this.u_useTransformMatrix, true);
        for (i = 0; i < 3; i++)
        {
            switch (i)
            {
                case 0:
                    // Bind the buffer object to target
                    this.gl.bindBuffer(this.gl.ARRAY_BUFFER, this.vertexBufferVector10Ctr);
                    // Write date into the buffer object
                    this.gl.bufferData(this.gl.ARRAY_BUFFER, this.verticesVector10Ctr, this.gl.DYNAMIC_DRAW);
                    this.gl.uniform4f(this.u_color, 1.0, 0.0, 1.0, 1.0);
                    break;
                case 1:
                    // Bind the buffer object to target
                    this.gl.bindBuffer(this.gl.ARRAY_BUFFER, this.vertexBufferVector01Ctr);
                    // Write date into the buffer object
                    this.gl.bufferData(this.gl.ARRAY_BUFFER, this.verticesVector01Ctr, this.gl.DYNAMIC_DRAW);
                    this.gl.uniform4f(this.u_color, 0.0, 1.0, 1.0, 1.0);
                    break;
                case 2:
                    // Bind the buffer object to target
                    this.gl.bindBuffer(this.gl.ARRAY_BUFFER, this.vertexBufferVector11Ctr);
                    // Write date into the buffer object
                    this.gl.bufferData(this.gl.ARRAY_BUFFER, this.verticesVector11Ctr, this.gl.DYNAMIC_DRAW);
                    this.gl.uniform4f(this.u_color, 0.5, 0.5, 0.5, 1.0);
                    break;
            }
            // Assign the buffer object to a_Position variable
            this.gl.vertexAttribPointer(this.a_Position, 3, this.gl.FLOAT, false, this.FSIZE * this.countAttribData, 0);
            // Enable the assignment to a_Position variable
            this.gl.enableVertexAttribArray(this.a_Position);
            // Assign the buffer object to a_select variable
            this.gl.vertexAttribPointer(this.a_select, 1, this.gl.FLOAT, false, this.FSIZE * this.countAttribData, this.FSIZE * 3);
            // Enable the assignment to a_select variable
            this.gl.enableVertexAttribArray(this.a_select);
            // Disable the assignment to a_normal variable
            this.gl.disableVertexAttribArray(this.a_normal);
            // Assign the buffer object to a_transformMatrix variable
            this.gl.vertexAttribPointer(this.a_transformMatrix, 4, this.gl.FLOAT, false, this.FSIZE * this.countAttribData, this.FSIZE * 4);
            this.gl.vertexAttribPointer(this.a_transformMatrix + 1, 4, this.gl.FLOAT, false, this.FSIZE * this.countAttribData, this.FSIZE * (4 + 4));
            this.gl.vertexAttribPointer(this.a_transformMatrix + 2, 4, this.gl.FLOAT, false, this.FSIZE * this.countAttribData, this.FSIZE * (8 + 4));
            this.gl.vertexAttribPointer(this.a_transformMatrix + 3, 4, this.gl.FLOAT, false, this.FSIZE * this.countAttribData, this.FSIZE * (12 + 4));
            // Enable the assignment to a_transformMatrix variable
            this.gl.enableVertexAttribArray(this.a_transformMatrix);
            this.gl.enableVertexAttribArray(this.a_transformMatrix + 1);
            this.gl.enableVertexAttribArray(this.a_transformMatrix + 2);
            this.gl.enableVertexAttribArray(this.a_transformMatrix + 3);

            this.gl.uniform4f(this.u_colorSelect, 0.5, 0.5, 0.0, 1.0);

            this.gl.drawArrays(this.gl.LINES, 0, 2 * this.N_ctr * this.M_ctr);
        }

        const countIndicesOneTip = (this.nLatitudes - 1) * this.nLongitudes * 2 * 3;
        for (i = 0; i < 3; i++)
        {
            switch (i)
            {
                case 0:
                    // Bind the buffer object to target
                    this.gl.bindBuffer(this.gl.ARRAY_BUFFER, this.vertexBufferVector10TipCtr);
                    // Write date into the buffer object
                    this.gl.bufferData(this.gl.ARRAY_BUFFER, this.verticesVector10TipCtr, this.gl.DYNAMIC_DRAW);
                    this.gl.bindBuffer(this.gl.ELEMENT_ARRAY_BUFFER, this.indexBufferVector10TipCtr);
                    this.gl.bufferData(this.gl.ELEMENT_ARRAY_BUFFER, this.indicesVector10TipCtr, this.gl.DYNAMIC_DRAW);
                    break;
                case 1:
                    // Bind the buffer object to target
                    this.gl.bindBuffer(this.gl.ARRAY_BUFFER, this.vertexBufferVector01TipCtr);
                    // Write date into the buffer object
                    this.gl.bufferData(this.gl.ARRAY_BUFFER, this.verticesVector01TipCtr, this.gl.DYNAMIC_DRAW);
                    this.gl.bindBuffer(this.gl.ELEMENT_ARRAY_BUFFER, this.indexBufferVector01TipCtr);
                    this.gl.bufferData(this.gl.ELEMENT_ARRAY_BUFFER, this.indicesVector01TipCtr, this.gl.DYNAMIC_DRAW);
                    break;
                case 2:
                    // Bind the buffer object to target
                    this.gl.bindBuffer(this.gl.ARRAY_BUFFER, this.vertexBufferVector11TipCtr);
                    // Write date into the buffer object
                    this.gl.bufferData(this.gl.ARRAY_BUFFER, this.verticesVector11TipCtr, this.gl.DYNAMIC_DRAW);
                    this.gl.bindBuffer(this.gl.ELEMENT_ARRAY_BUFFER, this.indexBufferVector11TipCtr);
                    this.gl.bufferData(this.gl.ELEMENT_ARRAY_BUFFER, this.indicesVector11TipCtr, this.gl.DYNAMIC_DRAW);
                    break;
            }
            // Assign the buffer object to a_Position variable
            this.gl.vertexAttribPointer(this.a_Position, 3, this.gl.FLOAT, false, this.FSIZE * this.countAttribData, 0);
            // Enable the assignment to a_Position variable
            this.gl.enableVertexAttribArray(this.a_Position);
            // Assign the buffer object to a_select variable
            this.gl.vertexAttribPointer(this.a_select, 1, this.gl.FLOAT, false, this.FSIZE * this.countAttribData, this.FSIZE * 3);
            // Enable the assignment to a_select variable
            this.gl.enableVertexAttribArray(this.a_select);
            // Disable the assignment to a_normal variable
            this.gl.disableVertexAttribArray(this.a_normal);
            // Assign the buffer object to a_transformMatrix variable
            this.gl.vertexAttribPointer(this.a_transformMatrix, 4, this.gl.FLOAT, false, this.FSIZE * this.countAttribData, this.FSIZE * 4);
            this.gl.vertexAttribPointer(this.a_transformMatrix + 1, 4, this.gl.FLOAT, false, this.FSIZE * this.countAttribData, this.FSIZE * (4 + 4));
            this.gl.vertexAttribPointer(this.a_transformMatrix + 2, 4, this.gl.FLOAT, false, this.FSIZE * this.countAttribData, this.FSIZE * (8 + 4));
            this.gl.vertexAttribPointer(this.a_transformMatrix + 3, 4, this.gl.FLOAT, false, this.FSIZE * this.countAttribData, this.FSIZE * (12 + 4));
            // Enable the assignment to a_transformMatrix variable
            this.gl.enableVertexAttribArray(this.a_transformMatrix);
            this.gl.enableVertexAttribArray(this.a_transformMatrix + 1);
            this.gl.enableVertexAttribArray(this.a_transformMatrix + 2);
            this.gl.enableVertexAttribArray(this.a_transformMatrix + 3);

            this.gl.uniform4f(this.u_color, 0.0, 0.0, 0.0, 1.0);
            this.gl.uniform4f(this.u_colorSelect, 0.5, 0.5, 0.0, 1.0);

            this.gl.drawElements(this.gl.TRIANGLES, this.N_ctr * this.M_ctr * countIndicesOneTip, this.gl.UNSIGNED_SHORT, 0);
        }

        if (this.controlsParameters.NURBSSurface)
        {
            const N = this.controlsParameters.N;
            const M = this.controlsParameters.M;
            this.gl.uniform1f(this.u_useTransformMatrix, false);
            // Bind the buffer object to target
            this.gl.bindBuffer(this.gl.ARRAY_BUFFER, this.vertexBufferSpline);
            // Write date into the buffer object
            this.gl.bufferData(this.gl.ARRAY_BUFFER, this.verticesSpline, this.gl.DYNAMIC_DRAW);
            //var FSIZE = this.verticesSpline.BYTES_PER_ELEMENT;
            // Assign the buffer object to a_Position variable
            this.gl.vertexAttribPointer(this.a_Position, 3, this.gl.FLOAT, false, this.FSIZE * 6, 0);
            // Assign the buffer object to a_normal variable
            this.gl.vertexAttribPointer(this.a_normal, 3, this.gl.FLOAT, false, this.FSIZE * 6, this.FSIZE * 3);
            // Enable the assignment to a_Position variable
            this.gl.enableVertexAttribArray(this.a_Position);
            // Disable the assignment to a_select variable
            this.gl.disableVertexAttribArray(this.a_select);
            // Enable the assignment to a_normal variable
            this.gl.enableVertexAttribArray(this.a_normal);
            // Disable the assignment to a_transformMatrix variable
            this.gl.disableVertexAttribArray(this.a_transformMatrix);
            this.gl.disableVertexAttribArray(this.a_transformMatrix + 1);
            this.gl.disableVertexAttribArray(this.a_transformMatrix + 2);
            this.gl.disableVertexAttribArray(this.a_transformMatrix + 3);

            this.gl.uniform4f(this.u_color, 1.0, 0.0, 0.0, 1.0);
            this.gl.uniform1f(this.u_pointSize, 5.0);

            switch (this.controlsParameters.visualize)
            {
                case "points":
                    this.gl.drawArrays(this.gl.POINTS, 0, N * M);
                    break;
                case "lines":
                    this.gl.bindBuffer(this.gl.ELEMENT_ARRAY_BUFFER, this.indexBufferSplineLines);
                    this.gl.bufferData(this.gl.ELEMENT_ARRAY_BUFFER, this.indicesSplineLines, this.gl.DYNAMIC_DRAW);

                    this.gl.uniform4f(this.u_color, 0.0, 1.0, 1.0, 1.0);

                    for (i = 0; i < N; i++)
                        this.gl.drawElements(this.gl.LINE_STRIP, M, this.gl.UNSIGNED_SHORT, ((i * M) * this.ISIZE));

                    this.gl.uniform4f(this.u_color, 1.0, 0.0, 1.0, 1.0);

                    for (j = 0; j < M; j++)
                        this.gl.drawElements(this.gl.LINE_STRIP, N, this.gl.UNSIGNED_SHORT, ((N * M + j * N) * this.ISIZE));
                    break;
                case "surface":
                    this.gl.bindBuffer(this.gl.ELEMENT_ARRAY_BUFFER, this.indexBufferSplineSurface);
                    this.gl.bufferData(this.gl.ELEMENT_ARRAY_BUFFER, this.indicesSplineSurface, this.gl.DYNAMIC_DRAW);

                    this.gl.uniform1f(this.u_drawPolygon, true);
                    // this.gl.depthMask(false);
                    // this.gl.enable(this.gl.BLEND);
                    // this.gl.blendFunc(this.gl.SRC_ALPHA, this.gl.ONE_MINUS_SRC_ALPHA);
                    this.gl.uniform4f(this.u_color, 0.5075, 0.5075, 0.5075, 1.0);
                    this.gl.drawElements(this.gl.TRIANGLES, 6 * (N - 1) * (M - 1), this.gl.UNSIGNED_SHORT, 0);
                    // this.gl.disable(this.gl.BLEND);
                    // this.gl.depthMask(true);
                    break;
            }

            if (this.controlsParameters.showNormals)
            {
                // Bind the buffer object to target
                this.gl.bindBuffer(this.gl.ARRAY_BUFFER, this.vertexBufferNormalVector);
                // Write date into the buffer object
                this.gl.bufferData(this.gl.ARRAY_BUFFER, this.verticesNormalVector, this.gl.DYNAMIC_DRAW);
                this.gl.uniform4f(this.u_color, 0.0, 0.0, 0.0, 1.0);
                // Assign the buffer object to a_Position variable
                this.gl.vertexAttribPointer(this.a_Position, 3, this.gl.FLOAT, false, 0, 0);
                // Enable the assignment to a_Position variable
                this.gl.enableVertexAttribArray(this.a_Position);
                // Disable the assignment to a_select variable
                this.gl.disableVertexAttribArray(this.a_select);
                // Disable the assignment to a_normal variable
                this.gl.disableVertexAttribArray(this.a_normal);
                this.gl.drawArrays(this.gl.LINES, 0, 2 * N * M);

                this.gl.uniform1f(this.u_useTransformMatrix, true);
                const countIndicesOneTip = (this.nLatitudes - 1) * this.nLongitudes * 2 * 3;

                // Bind the buffer object to target
                this.gl.bindBuffer(this.gl.ARRAY_BUFFER, this.vertexBufferNormalVectorTip);
                // Write date into the buffer object
                this.gl.bufferData(this.gl.ARRAY_BUFFER, this.verticesNormalVectorTip, this.gl.DYNAMIC_DRAW);
                this.gl.bindBuffer(this.gl.ELEMENT_ARRAY_BUFFER, this.indexBufferNormalVectorTip);
                this.gl.bufferData(this.gl.ELEMENT_ARRAY_BUFFER, this.indicesNormalVectorTip, this.gl.DYNAMIC_DRAW);

                // Assign the buffer object to a_Position variable
                this.gl.vertexAttribPointer(this.a_Position, 3, this.gl.FLOAT, false, this.FSIZE * this.countAttribData, 0);
                // Enable the assignment to a_Position variable
                this.gl.enableVertexAttribArray(this.a_Position);
                // Disable the assignment to a_select variable
                this.gl.disableVertexAttribArray(this.a_select);
                // Disable the assignment to a_normal variable
                this.gl.disableVertexAttribArray(this.a_normal);
                // Assign the buffer object to a_transformMatrix variable
                this.gl.vertexAttribPointer(this.a_transformMatrix, 4, this.gl.FLOAT, false, this.FSIZE * this.countAttribData, this.FSIZE * 4);
                this.gl.vertexAttribPointer(this.a_transformMatrix + 1, 4, this.gl.FLOAT, false, this.FSIZE * this.countAttribData, this.FSIZE * (4 + 4));
                this.gl.vertexAttribPointer(this.a_transformMatrix + 2, 4, this.gl.FLOAT, false, this.FSIZE * this.countAttribData, this.FSIZE * (8 + 4));
                this.gl.vertexAttribPointer(this.a_transformMatrix + 3, 4, this.gl.FLOAT, false, this.FSIZE * this.countAttribData, this.FSIZE * (12 + 4));
                // Enable the assignment to a_transformMatrix variable
                this.gl.enableVertexAttribArray(this.a_transformMatrix);
                this.gl.enableVertexAttribArray(this.a_transformMatrix + 1);
                this.gl.enableVertexAttribArray(this.a_transformMatrix + 2);
                this.gl.enableVertexAttribArray(this.a_transformMatrix + 3);

                this.gl.uniform4f(this.u_color, 0.0, 0.0, 0.0, 1.0);

                this.gl.drawElements(this.gl.TRIANGLES, N * M * countIndicesOneTip, this.gl.UNSIGNED_SHORT, 0);
            }
        }

        if (this.controlsParameters.triangleSurfaceMesh)
        {
            for (let i = 0; i < this.pointsTriangulation.length; ++i)
            {
                this.pointsTriangulation[i].calculateWindowCoordinates(mvpMatr, this.viewport);
            }

            this.gl.uniform1f(this.u_useTransformMatrix, false);
            // Bind the buffer object to target
            this.gl.bindBuffer(this.gl.ARRAY_BUFFER, this.vertexBufferTriangulation);
            // Write date into the buffer object
            this.gl.bufferData(this.gl.ARRAY_BUFFER, this.verticesTriangulation, this.gl.DYNAMIC_DRAW);
            //var FSIZE = this.verticesSpline.BYTES_PER_ELEMENT;
            // Assign the buffer object to a_Position variable
            this.gl.vertexAttribPointer(this.a_Position, 3, this.gl.FLOAT, false, this.FSIZE * 7, 0);
            // Assign the buffer object to a_select variable
            this.gl.vertexAttribPointer(this.a_select, 1, this.gl.FLOAT, false, this.FSIZE * 7, this.FSIZE * 3);
            // Assign the buffer object to a_normal variable
            this.gl.vertexAttribPointer(this.a_normal, 3, this.gl.FLOAT, false, this.FSIZE * 7, this.FSIZE * 4);
            // Enable the assignment to a_Position variable
            this.gl.enableVertexAttribArray(this.a_Position);
            // Disable the assignment to a_select variable
            this.gl.disableVertexAttribArray(this.a_select);
            // Enable the assignment to a_normal variable
            this.gl.enableVertexAttribArray(this.a_normal);
            // Disable the assignment to a_transformMatrix variable
            this.gl.disableVertexAttribArray(this.a_transformMatrix);
            this.gl.disableVertexAttribArray(this.a_transformMatrix + 1);
            this.gl.disableVertexAttribArray(this.a_transformMatrix + 2);
            this.gl.disableVertexAttribArray(this.a_transformMatrix + 3);

            this.gl.uniform4f(this.u_color, 128 / 256, 0.0, 128 / 256, 1.0);
            // this.gl.uniform4f(this.u_colorSelect, 255 / 256, 165 / 256, 0.0, 1.0);
            this.gl.uniform1f(this.u_pointSize, 5.0);
            // this.gl.uniform1f(this.u_pointSizeSelect, 7.0);

            switch (this.controlsParameters.triangleVisualize)
            {
                case "points":
                    this.gl.drawArrays(this.gl.POINTS, 0, this.pointsTriangulation.length);
                    break;
                case "lines":
                    this.gl.bindBuffer(this.gl.ELEMENT_ARRAY_BUFFER, this.indexBufferTriangulationLines);
                    this.gl.bufferData(this.gl.ELEMENT_ARRAY_BUFFER, this.indicesTriangulationLines, this.gl.DYNAMIC_DRAW);
                    this.gl.uniform4f(this.u_color, 66 / 256, 49 / 256, 137 / 256, 1.0);

                    this.gl.drawElements(this.gl.LINES, this.indicesTriangulationLines.length, this.gl.UNSIGNED_SHORT, 0 * this.ISIZE);
                    break;
                case "surface":
                    this.gl.bindBuffer(this.gl.ELEMENT_ARRAY_BUFFER, this.indexBufferTriangulationSurface);
                    this.gl.bufferData(this.gl.ELEMENT_ARRAY_BUFFER, this.indicesTriangulationSurface, this.gl.DYNAMIC_DRAW);

                    this.gl.uniform1f(this.u_drawPolygon, true);
                    this.gl.drawElements(this.gl.TRIANGLES, this.indicesTriangulationSurface.length, this.gl.UNSIGNED_SHORT, 0 * this.ISIZE);
                    this.gl.uniform1f(this.u_drawPolygon, false);
                    break;
            }

            // selected closed area drawing
            if (this.controlsParameters.closedArea && this.pointsCtrClosedArea.length != 0)
            {
                for (let i = 0; i < this.pointsCtrClosedArea.length; ++i)
                {
                    this.pointsCtrClosedArea[i].calculateWindowCoordinates(mvpMatr, this.viewport);
                }

                this.gl.uniform1f(this.u_useTransformMatrix, false);
                this.gl.enableVertexAttribArray(this.a_Position);
                this.gl.disableVertexAttribArray(this.a_select);
                this.gl.disableVertexAttribArray(this.a_normal);
                this.gl.disableVertexAttribArray(this.a_transformMatrix);
                this.gl.disableVertexAttribArray(this.a_transformMatrix + 1);
                this.gl.disableVertexAttribArray(this.a_transformMatrix + 2);
                this.gl.disableVertexAttribArray(this.a_transformMatrix + 3);

                this.gl.uniform4f(this.u_color, 255 / 256, 165 / 256, 0.0, 1.0);
                this.gl.uniform1f(this.u_pointSize, 7.0);

                this.gl.bindBuffer(this.gl.ARRAY_BUFFER, this.vertexBufferClosedArea);

                this.gl.bufferData(this.gl.ARRAY_BUFFER, this.verticesCtrClosedArea, this.gl.DYNAMIC_DRAW);
                this.gl.vertexAttribPointer(this.a_Position, 3, this.gl.FLOAT, false, this.FSIZE * 3, 0);
                this.gl.drawArrays(this.gl.POINTS, 0, this.pointsCtrClosedArea.length);

                this.gl.bufferData(this.gl.ARRAY_BUFFER, this.verticesClosedArea, this.gl.DYNAMIC_DRAW);
                this.gl.vertexAttribPointer(this.a_Position, 3, this.gl.FLOAT, false, this.FSIZE * 3, 0);
                this.gl.drawArrays(this.gl.LINE_STRIP, 0, this.pointsClosedArea.length);
            }
        }
    },

    calculateAndDraw: function (changedDegree = false)
    {
        if (this.controlsParameters.NURBSSurface)
        {
            this.calculateNURBSSurface();

            if (changedDegree && this.controlsParameters.triangleSurfaceMesh)
            {
                this.calculateTriangulationMesh();

                if (this.controlsParameters.closedArea)
                {
                    this.calculateClosedArea();
                }
            }
        }

        this.setVertexBuffersAndDraw();
    },

    calculateMeshAndDraw: function ()
    {
        if (this.controlsParameters.triangleSurfaceMesh)
        {
            this.calculateTriangulationMesh();

            if (this.controlsParameters.closedArea)
            {
                this.calculateClosedArea();

                if (this.controlsParameters.constrainedTriangulation)
                {
                    this.calculateConstrainedTriangulation();
                }
            }
        }

        this.setVertexBuffersAndDraw();
    },

    // NURBS SURFACE

    calculateNURBSSurface: function ()
    {
        // Получаем размеры контрольной сетки и сетки для отображения
        const N_ctr = this.N_ctr; // Количество контрольных точек по U
        const M_ctr = this.M_ctr; // Количество контрольных точек по V
        const N = this.controlsParameters.N; // Количество точек для отображения по U
        const M = this.controlsParameters.M; // Количество точек для отображения по V

        // Степень поверхности (по умолчанию 3 - бикубическая)
        const degreeU = this.controlsParameters.degreeU || 3;
        const degreeV = this.controlsParameters.degreeV || 3;

        if (N_ctr - 1 < degreeU)
        {
            console.log("ERROR: N_ctr should be at least equal to degreeU + 1");
        }
        if (M_ctr - 1 < degreeV)
        {
            console.log("ERROR: M_ctr should be at least equal to degreeV + 1");
        }

        // Инициализация узловых векторов если они еще не заданы
        if (!this.knotVectorU || this.knotVectorU.length !== N_ctr + degreeU + 1)
        {
            this.knotVectorU = this.generateKnotVector(N_ctr, degreeU, "u");
        }
        if (!this.knotVectorV || this.knotVectorV.length !== M_ctr + degreeV + 1)
        {
            this.knotVectorV = this.generateKnotVector(M_ctr, degreeV, "v");
        }

        // Инициализация весов контрольных точек (по умолчанию все 1)
        if (!this.weights || this.weights.length !== N_ctr)
        {
            this.weights = new Array(N_ctr);
            for (let i = 0; i < N_ctr; i++)
            {
                this.weights[i] = new Array(M_ctr).fill(1.0);
            }
        }

        // Выделяем память для точек поверхности и нормалей
        this.pointsSpline = new Array(N);
        this.normalsSpline = new Array(N);
        for (let i = 0; i < N; i++)
        {
            this.pointsSpline[i] = new Array(M);
            this.normalsSpline[i] = new Array(M);
            for (let j = 0; j < M; j++)
            {
                this.normalsSpline[i][j] = new Array(3);
            }
        }

        // Определяем диапазон параметров для вычисления
        const uMin = this.knotVectorU[degreeU];
        const uMax = this.knotVectorU[N_ctr];
        const vMin = this.knotVectorV[degreeV];
        const vMax = this.knotVectorV[M_ctr];

        // Шаги для параметров u и v (расстояние между соседними точками на поверхности вдоль параметров u и v)
        const du = (uMax - uMin) / (N - 1);
        const dv = (vMax - vMin) / (M - 1);

        // Вычисляем точки поверхности
        for (let i = 0; i < N; i++)
        {
            const u = uMin + i * du; // Текущее значение параметра u
            for (let j = 0; j < M; j++)
            {
                const v = vMin + j * dv; // Текущее значение параметра v

                // Вычисляем точку на поверхности и нормаль
                const pt = this.evaluateNURBS(u, v, degreeU, degreeV);

                // Сохраняем точку поверхности
                this.pointsSpline[i][j] = new Point(pt.point.x, pt.point.y, pt.point.z);

                // Сохраняем нормаль
                this.normalsSpline[i][j][0] = pt.normal.x;
                this.normalsSpline[i][j][1] = pt.normal.y;
                this.normalsSpline[i][j][2] = pt.normal.z;
            }
        }

        // Создаем данные для визуализации (подсказки и нормали)
        this.create_coord_tip("normals", this.heighTip, N, M);
        this.create_indexes_tip("normals", N, M);

        // Подготавливаем данные для WebGL
        this.verticesSpline = new Float32Array(N * M * 6);
        this.verticesNormalVector = new Float32Array(N * M * 6);

        for (let i = 0; i < N; i++)
        {
            for (let j = 0; j < M; j++)
            {
                const offset = i * M + j;

                // Записываем координаты точки и нормаль
                this.verticesSpline[offset * 6] = this.pointsSpline[i][j].x;
                this.verticesSpline[offset * 6 + 1] = this.pointsSpline[i][j].y;
                this.verticesSpline[offset * 6 + 2] = this.pointsSpline[i][j].z;
                this.verticesSpline[offset * 6 + 3] = this.normalsSpline[i][j][0];
                this.verticesSpline[offset * 6 + 4] = this.normalsSpline[i][j][1];
                this.verticesSpline[offset * 6 + 5] = this.normalsSpline[i][j][2];

                // Записываем данные для отображения нормалей
                this.verticesNormalVector[2 * offset * 3] = this.pointsSpline[i][j].x;
                this.verticesNormalVector[2 * offset * 3 + 1] = this.pointsSpline[i][j].y;
                this.verticesNormalVector[2 * offset * 3 + 2] = this.pointsSpline[i][j].z;
                this.verticesNormalVector[(2 * offset + 1) * 3] = this.pointsSpline[i][j].x + this.normalsSpline[i][j][0];
                this.verticesNormalVector[(2 * offset + 1) * 3 + 1] = this.pointsSpline[i][j].y + this.normalsSpline[i][j][1];
                this.verticesNormalVector[(2 * offset + 1) * 3 + 2] = this.pointsSpline[i][j].z + this.normalsSpline[i][j][2];

                // Устанавливаем вектор нормали
                this.setVector(
                    this.verticesNormalVector[2 * offset * 3],
                    this.verticesNormalVector[2 * offset * 3 + 1],
                    this.verticesNormalVector[2 * offset * 3 + 2],
                    this.verticesNormalVector[(2 * offset + 1) * 3],
                    this.verticesNormalVector[(2 * offset + 1) * 3 + 1],
                    this.verticesNormalVector[(2 * offset + 1) * 3 + 2],
                    "normal", false, i, j
                );
            }
        }

        // Создаем индексы для линий и поверхности
        this.createIndicesSplineLines(N, M);
        this.createIndicesSplineSurface(N, M);
    },

    // Генерация равномерного узлового вектора
    generateKnotVector: function (numControlPoints, degree, direction)
    {
        const n = numControlPoints - 1;
        const m = n + degree + 1;
        const knotVector = new Array(m + 1);

        // Создаем равномерный узловой вектор
        for (let i = 0; i <= m; i++)
        {
            if (i <= degree)
            {
                knotVector[i] = 0; // Первые degree+1 узлов = 0
            }
            else if (i >= m - degree)
            {
                knotVector[i] = m - 2 * degree; // Последние degree+1 узлов = максимальное значение
            }
            else
            {
                knotVector[i] = i - degree; // Промежуточные узлы
            }
        }

        // Нормализуем к диапазону [0,1]
        const max = knotVector[m];
        for (let i = 0; i <= m; i++)
        {
            knotVector[i] /= max;
        }

        return knotVector;
    },

    // Вычисление точки на NURBS-поверхности
    evaluateNURBS: function (u, v, degreeU, degreeV)
    {
        // Находим интервалы для параметров u и v
        const spanU = this.findSpan(u, degreeU, this.knotVectorU);
        const spanV = this.findSpan(v, degreeV, this.knotVectorV);

        // Вычисляем базисные функции
        const basisU = this.basisFunctions(spanU, u, degreeU, this.knotVectorU);
        const basisV = this.basisFunctions(spanV, v, degreeV, this.knotVectorV);

        // Инициализируем точку и производные
        const point = { x: 0, y: 0, z: 0, w: 0 };

        // Вычисляем взвешенную сумму контрольных точек
        for (let i = 0; i <= degreeU; i++)
        {
            for (let j = 0; j <= degreeV; j++)
            {
                const cp = this.pointsCtr[spanU - degreeU + i][spanV - degreeV + j];
                const weight = this.weights[spanU - degreeU + i][spanV - degreeV + j];

                const temp = basisU[i] * basisV[j] * weight;

                point.x += cp.x * temp;
                point.y += cp.y * temp;
                point.z += cp.z * temp;
                point.w += temp;
            }
        }

        // Преобразуем в декартовы координаты (делим на вес)
        const cartesian = {
            x: point.x / point.w,
            y: point.y / point.w,
            z: point.z / point.w
        };

        // Вычисляем нормаль к поверхности
        const normal = this.evaluateNURBSNormal(u, v, spanU, spanV);

        return {
            point: cartesian,
            normal: { x: normal[0], y: normal[1], z: normal[2] }
        };
    },

    // Нахождение интервала для параметра
    findSpan: function (u, degree, knotVector)
    {
        const n = knotVector.length - degree - 2;

        // Особые случаи для граничных значений
        if (u >= knotVector[n + 1]) return n;
        if (u <= knotVector[degree]) return degree;

        // Бинарный поиск интервала
        let low = degree;
        let high = n + 1;
        let mid = Math.floor((low + high) / 2);

        while (u < knotVector[mid] || u >= knotVector[mid + 1])
        {
            if (u < knotVector[mid])
            {
                high = mid;
            }
            else
            {
                low = mid;
            }
            mid = Math.floor((low + high) / 2);
        }

        return mid;
    },

    // Вычисление базисных функций B-сплайна
    basisFunctions: function (span, u, degree, knotVector)
    {
        const N = new Array(degree + 1);
        const left = new Array(degree + 1);
        const right = new Array(degree + 1);

        N[0] = 1.0;

        for (let j = 1; j <= degree; j++)
        {
            left[j] = u - knotVector[span + 1 - j];
            right[j] = knotVector[span + j] - u;

            let saved = 0.0;

            for (let r = 0; r < j; r++)
            {
                const temp = N[r] / (right[r + 1] + left[j - r]);
                N[r] = saved + right[r + 1] * temp;
                saved = left[j - r] * temp;
            }

            N[j] = saved;
        }

        return N;
    },

    // // Вычисление нормали к поверхности
    // computeSurfaceNormal: function (u, v, degreeU, degreeV)
    // {
    //     // Находим интервалы
    //     const spanU = this.findSpan(u, degreeU, this.knotVectorU);
    //     const spanV = this.findSpan(v, degreeV, this.knotVectorV);

    //     // Вычисляем базисные функции и их производные
    //     const basisAndDerivU = this.basisFunctionsWithDerivatives(spanU, u, degreeU, this.knotVectorU, 1);
    //     const basisAndDerivV = this.basisFunctionsWithDerivatives(spanV, v, degreeV, this.knotVectorV, 1);

    //     // Инициализируем точки и производные
    //     const point = { x: 0, y: 0, z: 0, w: 0 };
    //     const du = { x: 0, y: 0, z: 0, w: 0 };
    //     const dv = { x: 0, y: 0, z: 0, w: 0 };

    //     // Вычисляем взвешенные суммы
    //     for (let i = 0; i <= degreeU; i++)
    //     {
    //         for (let j = 0; j <= degreeV; j++)
    //         {
    //             const cp = this.pointsCtr[spanU - degreeU + i][spanV - degreeV + j];
    //             const weight = this.weights[spanU - degreeU + i][spanV - degreeV + j];

    //             // Точка
    //             const temp = basisAndDerivU[0][i] * basisAndDerivV[0][j] * weight;
    //             point.x += cp.x * temp;
    //             point.y += cp.y * temp;
    //             point.z += cp.z * temp;
    //             point.w += temp;

    //             // Производная по u
    //             const tempU = basisAndDerivU[1][i] * basisAndDerivV[0][j] * weight;
    //             du.x += cp.x * tempU;
    //             du.y += cp.y * tempU;
    //             du.z += cp.z * tempU;
    //             du.w += tempU;

    //             // Производная по v
    //             const tempV = basisAndDerivU[0][i] * basisAndDerivV[1][j] * weight;
    //             dv.x += cp.x * tempV;
    //             dv.y += cp.y * tempV;
    //             dv.z += cp.z * tempV;
    //             dv.w += tempV;
    //         }
    //     }

    //     // Преобразуем производные в декартовы координаты
    //     const w = point.w;
    //     const w2 = w * w;

    //     const Su = {
    //         x: (du.x * w - point.x * du.w) / w2,
    //         y: (du.y * w - point.y * du.w) / w2,
    //         z: (du.z * w - point.z * du.w) / w2
    //     };

    //     const Sv = {
    //         x: (dv.x * w - point.x * dv.w) / w2,
    //         y: (dv.y * w - point.y * dv.w) / w2,
    //         z: (dv.z * w - point.z * dv.w) / w2
    //     };

    //     // Нормаль как векторное произведение производных
    //     const normal = {
    //         x: Su.y * Sv.z - Su.z * Sv.y,
    //         y: Su.z * Sv.x - Su.x * Sv.z,
    //         z: Su.x * Sv.y - Su.y * Sv.x
    //     };

    //     // Нормализуем вектор
    //     const len = Math.sqrt(normal.x * normal.x + normal.y * normal.y + normal.z * normal.z);
    //     if (len > 0)
    //     {
    //         normal.x /= len;
    //         normal.y /= len;
    //         normal.z /= len;
    //     }

    //     return normal;
    // },

    // Вычисление базисных функций и их производных
    basisFunctionsWithDerivatives: function (span, u, degree, knotVector, derivs)
    {
        // Матрица для хранения базисных функций
        const ndu = new Array(degree + 1);
        for (let i = 0; i <= degree; i++)
        {
            ndu[i] = new Array(degree + 1).fill(0);
        }

        ndu[0][0] = 1.0;

        const left = new Array(degree + 1);
        const right = new Array(degree + 1);

        // Вычисляем базисные функции
        for (let j = 1; j <= degree; j++)
        {
            left[j] = u - knotVector[span + 1 - j];
            right[j] = knotVector[span + j] - u;

            let saved = 0.0;

            for (let r = 0; r < j; r++)
            {
                ndu[j][r] = right[r + 1] + left[j - r];
                const temp = ndu[r][j - 1] / ndu[j][r];

                ndu[r][j] = saved + right[r + 1] * temp;
                saved = left[j - r] * temp;
            }

            ndu[j][j] = saved;
        }

        // Инициализация производных
        const ders = new Array(derivs + 1);
        for (let i = 0; i <= derivs; i++)
        {
            ders[i] = new Array(degree + 1).fill(0);
        }

        // Заполняем базисные функции
        for (let j = 0; j <= degree; j++)
        {
            ders[0][j] = ndu[j][degree];
        }

        // Вычисляем производные
        const a = new Array(2);
        for (let i = 0; i <= degree; i++)
        {
            a[0] = new Array(degree + 1);
            a[1] = new Array(degree + 1);
        }

        for (let r = 0; r <= degree; r++)
        {
            let s1 = 0;
            let s2 = 1;
            a[0][0] = 1.0;

            for (let k = 1; k <= derivs; k++)
            {
                let d = 0.0;
                const rk = r - k;
                const pk = degree - k;

                if (r >= k)
                {
                    a[s2][0] = a[s1][0] / ndu[pk + 1][rk];
                    d = a[s2][0] * ndu[rk][pk];
                }

                const j1 = (rk >= -1) ? 1 : -rk;
                const j2 = (r - 1 <= pk) ? k - 1 : degree - r;

                for (let j = j1; j <= j2; j++)
                {
                    a[s2][j] = (a[s1][j] - a[s1][j - 1]) / ndu[pk + 1][rk + j];
                    d += a[s2][j] * ndu[rk + j][pk];
                }

                if (r <= pk)
                {
                    a[s2][k] = -a[s1][k - 1] / ndu[pk + 1][r];
                    d += a[s2][k] * ndu[r][pk];
                }

                ders[k][r] = d;

                // Меняем строки местами
                const temp = s1;
                s1 = s2;
                s2 = temp;
            }
        }

        // Умножаем на правильные коэффициенты
        let r = degree;
        for (let k = 1; k <= derivs; k++)
        {
            for (let j = 0; j <= degree; j++)
            {
                ders[k][j] *= r;
            }
            r *= (degree - k);
        }

        return ders;
    },

    evaluateNURBSDerivatives: function (u, v, spanU, spanV, du, dv) // (u, v) - param coords, (ii, jj) - spans, (du, dv) - ders degrees S_du_dv
    {
        let ders = vec3.fromValues(0, 0, 0);

        const degreeU = this.controlsParameters.degreeU;
        const degreeV = this.controlsParameters.degreeV;

        du = Math.min(du, degreeU);
        dv = Math.min(dv, degreeV);

        const basisAndDerivU = this.basisFunctionsWithDerivatives(spanU, u, degreeU, this.knotVectorU, du);
        const basisAndDerivV = this.basisFunctionsWithDerivatives(spanV, v, degreeV, this.knotVectorV, dv);

        const N_du = basisAndDerivU[du];
        const N_dv = basisAndDerivV[dv];

        // S_du_dv (u, v) = summ(Ni_du(u) * Nj_dv(v) * wij * Pij, {i, j})
        for (let i = 0; i <= degreeU; ++i)
        {
            const Ni_du = N_du[i];

            for (let j = 0; j <= degreeV; ++j)
            {
                const Nj_dv = N_dv[j];
                const p_ij = this.pointsCtr[spanU - degreeU + i][spanV - degreeV + j];
                const w_ij = this.weights[spanU - degreeU + i][spanV - degreeV + j]; // all equals to 1

                const temp = Ni_du * Nj_dv * w_ij;
                ders[0] += temp * p_ij.x;
                ders[1] += temp * p_ij.y;
                ders[2] += temp * p_ij.z;
            }
        }

        return ders;
    },

    evaluateNURBSNormal: function (u, v, spanU, spanV)
    {
        let norm = vec3.cross(vec3.create(), this.evaluateNURBSDerivatives(u, v, spanU, spanV, 1, 0), this.evaluateNURBSDerivatives(u, v, spanU, spanV, 0, 1));
        vec3.normalize(norm, norm);
        return norm;
    },

    matrix_G: function (u, v, spanU, spanV) // coefficients 1-st quadratic form
    {
        const S_u = this.evaluateNURBSDerivatives(u, v, spanU, spanV, 1, 0);
        const S_v = this.evaluateNURBSDerivatives(u, v, spanU, spanV, 0, 1);

        return mat2.fromValues(vec3.dot(S_u, S_u), vec3.dot(S_v, S_u), vec3.dot(S_u, S_v), vec3.dot(S_v, S_v));
    },

    matrix_B: function (u, v, spanU, spanV) // coefficients 2-nd quadratic form
    {
        const nS = this.evaluateNURBSNormal(u, v, spanU, spanV);
        const S_uu = this.evaluateNURBSDerivatives(u, v, spanU, spanV, 2, 0);
        const S_uv = this.evaluateNURBSDerivatives(u, v, spanU, spanV, 1, 1);
        const S_vv = this.evaluateNURBSDerivatives(u, v, spanU, spanV, 0, 2);

        // TODO: Do we need abs Math.abs(Math.dot(...)) ???
        return mat2.fromValues(vec3.dot(nS, S_uu),
            vec3.dot(nS, S_uv),
            vec3.dot(nS, S_uv),
            vec3.dot(nS, S_vv));
    },

    // TRIANGULATION

    calculateTriangulationMesh: function ()
    {
        this.pointsTriangulation = [];
        this.normalsTriangulation = [];

        // Инициализация параметров
        let params = { u: 0, v: 0 }; // Текущие параметры u, v ∈ [0,1]
        let du = 0, dv = 0; // Адаптивные шаги
        let spanU = 0, spanV = 0; // Индексы текущего сегмента
        let degreeU = this.controlsParameters.degreeU, degreeV = this.controlsParameters.degreeV;

        // Основной цикл по параметру u
        while (params.u + du <= 1 && params.u != 1)
        {
            params.u += du;

            spanU = this.findSpan(params.u, degreeU, this.knotVectorU);

            // Сброс параметров для v
            params.v = 0;
            dv = 0;
            spanV = this.findSpan(params.v, degreeV, this.knotVectorV);

            // Вычисляем шаг по u
            du = this.calculateAdaptiveStep("u", params.u, params.v, spanU, spanV);

            // Цикл по параметру v
            while (params.v + dv <= 1 && params.v != 1)
            {
                params.v += dv;

                spanV = this.findSpan(params.v, degreeV, this.knotVectorV);

                // Вычисляем шаг по v
                dv = this.calculateAdaptiveStep("v", params.u, params.v, spanU, spanV);

                // Вычисляем точку и нормаль на поверхности
                const pt = this.evaluateNURBS(params.u, params.v, degreeU, degreeV);

                // Сохраняем точку
                const point = new Point(pt.point.x, pt.point.y, pt.point.z);
                point.u = params.u;
                point.v = params.v;
                this.pointsTriangulation.push(point);

                // Сохраняем нормаль
                this.normalsTriangulation.push(pt.normal);

                // Корректируем шаг по u
                du = Math.min(du, this.calculateAdaptiveStep("u", params.u, params.v, spanU, spanV));
            }
        }

        this.calculateDelaunayTriangulation(this.pointsTriangulation);
        this.updateTriangulationDrawBuffers();
    },

    calculateAdaptiveStep: function (param, u, v, spanU, spanV)
    {
        let delta = this.controlsParameters.adaptDelta;

        const stepMin = 0.005;
        const stepMax = 0.05;

        let k = param == "u" ? 0 : 3; // use _uu or _vv derivatives
        // Вычисляем первую фундаментальную форму
        const G = this.matrix_G(u, v, spanU, spanV);
        // Вычисляем вторую фундаментальную форму
        const B = this.matrix_B(u, v, spanU, spanV);

        // Вычисляем шаг на основе кривизны
        let step = 2 * Math.sqrt(delta * (2 * G[k] / B[k] - delta) / G[k]);
        // Близкое к нулю B[k] говорит о линейности / развиваемости вдоль данного направления -> берем макс шаг
        if (!step)
        {
            step = stepMax;
        }

        // Ограничиваем шаг
        step = Math.max(stepMin, Math.min(stepMax, step));

        // Корректируем шаг, чтобы не выйти за границы (если последний шаг будет меньше stepMin, то "дотягиваем" предыдущий шаг до границы)
        if (param === "u" && (1 - u - step) < stepMin)
        {
            step = 1 - u;
        }
        else if (param === "v" && (1 - v - step) < stepMin)
        {
            step = 1 - v;
        }

        return step;
    },

    createVerticesTriangulation: function ()
    {
        this.verticesTriangulation = new Float32Array(this.pointsTriangulation.length * 7);

        for (let i = 0; i < this.pointsTriangulation.length; i++)
        {
            const offset = i * 7;
            this.verticesTriangulation[offset] = this.pointsTriangulation[i].x;
            this.verticesTriangulation[offset + 1] = this.pointsTriangulation[i].y;
            this.verticesTriangulation[offset + 2] = this.pointsTriangulation[i].z;
            this.verticesTriangulation[offset + 3] = this.pointsTriangulation[i].select;
            this.verticesTriangulation[offset + 4] = this.normalsTriangulation[i].x;
            this.verticesTriangulation[offset + 5] = this.normalsTriangulation[i].y;
            this.verticesTriangulation[offset + 6] = this.normalsTriangulation[i].z;
        }
    },

    createIndicesTriangulationLines: function (triangles)
    {
        // Индексация для построения линий (треугольников)
        let i, k = 0;
        this.indicesTriangulationLines = new Uint16Array(triangles.length * 6);

        for (i = 0; i < triangles.length; i++)
        {
            if (!triangles[i])
            {
                continue;
            }

            const idx1 = this.pointsTriangulation.indexOf(triangles[i].v1);
            const idx2 = this.pointsTriangulation.indexOf(triangles[i].v2);
            const idx3 = this.pointsTriangulation.indexOf(triangles[i].v3);

            this.indicesTriangulationLines[k++] = idx1;
            this.indicesTriangulationLines[k++] = idx2;
            this.indicesTriangulationLines[k++] = idx2;
            this.indicesTriangulationLines[k++] = idx3;
            this.indicesTriangulationLines[k++] = idx3;
            this.indicesTriangulationLines[k++] = idx1;
        }
    },

    createIndicesTriangulationSurface: function (triangles)
    {
        // Индексация для построения поверхности
        let i, k = 0;
        this.indicesTriangulationSurface = new Uint16Array(triangles.length * 3);

        for (i = 0; i < triangles.length; i++)
        {
            if (!triangles[i])
            {
                continue;
            }

            this.indicesTriangulationSurface[k++] = this.pointsTriangulation.indexOf(triangles[i].v1);
            this.indicesTriangulationSurface[k++] = this.pointsTriangulation.indexOf(triangles[i].v2);
            this.indicesTriangulationSurface[k++] = this.pointsTriangulation.indexOf(triangles[i].v3);
        }
    },

    calculateDelaunayTriangulation: function (_points) // Delaunay triangulation
    {
        switch (this.controlsParameters.triangleMethod)
        {
            case 'iterative':
                {
                    this.delaunayTriangulation = new triangulation.DefaultTriangulationStrategy(_points, this);
                }
            case 'dyncache':
                {
                    this.delaunayTriangulation = new triangulation.DynamicCachingTriangulationStrategy(_points, this);
                }
        }

        this.delaunayTriangulation.calculate();
    },

    updateTriangulationDrawBuffers: function ()
    {
        this.createVerticesTriangulation();
        let triangles = this.delaunayTriangulation.triangles;

        this.createIndicesTriangulationLines(triangles);
        this.createIndicesTriangulationSurface(triangles);
    },

    // CLOSED AREA ON TRIANGULATION POINTS

    createCyclicSystem: function (_points, _t)
    {
        const N = _points.length - 1;
        const T = new Array(N);
        for (let i = 0; i < N; ++i)
        {
            T[i] = _t[i + 1] - _t[i];
        }

        const A = new Array(N);
        const Bu = new Array(N);
        const Bv = new Array(N);

        for (let i = 0; i < N; ++i)
        {
            A[i] = new Array(N).fill(0);

            if (i > 0)
            {
                A[i][i - 1] = T[i];
            }

            if (i < N - 1)
            {
                A[i][i] = 2 * (T[i + 1] + T[i]);
                A[i][i + 1] = T[i + 1];
            }
            else
            {
                A[i][i] = 2 * (T[0] + T[N - 1]);
            }
        }
        A[0][N - 1] = T[0];
        A[N - 1][0] = T[0];

        for (let i = 0; i < N - 1; ++i)
        {
            Bu[i] = 6 * (_points[i + 2].u - 2 * _points[i + 1].u + _points[i].u) / T[i];
            Bv[i] = 6 * (_points[i + 2].v - 2 * _points[i + 1].v + _points[i].v) / T[i];
        }
        Bu[N - 1] = 6 * ((_points[1].u - _points[0].u) / T[0] - (_points[N].u - _points[N - 1].u) / T[N - 1]);
        Bv[N - 1] = 6 * ((_points[1].v - _points[0].v) / T[0] - (_points[N].v - _points[N - 1].v) / T[N - 1]);

        return [A, Bu, Bv];
    },

    // system of matrix and right vector
    solveCyclicSystem: function (_A, _B)
    {
        const N = _A.length;

        const a = new Array(N).fill(0); // lower diag
        const b = new Array(N);         // main diag
        const c = new Array(N).fill(0); // upper diag

        for (let i = 1; i < N - 1; ++i)
        {
            a[i] = _A[i][i - 1];
            b[i] = _A[i][i];
            c[i] = _A[i][i + 1];
        }
        a[N - 1] = _A[N - 1][N - 2];
        b[0] = _A[0][0];
        b[N - 1] = _A[N - 1][N - 1];
        c[0] = _A[0][1];

        const p = new Array(N).fill(0);
        const q = new Array(N).fill(0);
        const r = new Array(N).fill(0);

        p[0] = c[0] / b[0];
        r[0] = _A[0][N - 1] / b[0];
        q[0] = _B[0] / b[0];

        // forward walk
        for (let i = 1; i < N; ++i)
        {
            const denom = b[i] - a[i] * p[i - 1];

            p[i] = c[i] / denom;
            q[i] = (_B[i] - a[i] * q[i - 1]) / denom;
            r[i] = (-a[i] * r[i - 1]) / denom;
        }

        const s = new Array(N).fill(0);
        const t = new Array(N).fill(0);
        s[N - 1] = 1;

        for (let i = N - 2; i >= 0; --i)
        {
            s[i] = -p[i] * s[i + 1] - r[i];
            t[i] = -p[i] * t[i + 1] + q[i];
        }

        // backward walk
        const M = new Array(N).fill(0);

        M[N - 1] = (_B[N - 1] - c[N - 1] * t[0] - a[N - 1] * t[N - 2]) / (c[N - 1] * s[0] + a[N - 1] * s[N - 2] + b[N - 1]);
        for (let i = N - 2; i >= 0; --i)
        {
            M[i] = s[i] * M[N - 1] + t[i];
        }

        return M;
    },

    calculateClosedArea: function ()
    {
        // recalculate {x, y, z} after moving and etc
        for (let i = 0; i < this.pointsCtrClosedArea.length; ++i)
        {
            let { point, normal } = this.evaluateNURBS(this.pointsCtrClosedArea[i].u, this.pointsCtrClosedArea[i].v, this.controlsParameters.degreeU, this.controlsParameters.degreeV);
            this.pointsCtrClosedArea[i].x = point.x;
            this.pointsCtrClosedArea[i].y = point.y;
            this.pointsCtrClosedArea[i].z = point.z;
        }

        this.createVerticesCtrClosedArea();

        if (this.pointsCtrClosedArea.length < 3)
        {
            console.warn(`Not enough ctr points for closed area: ${this.pointsCtrClosedArea.length}`);

            this.pointsClosedArea.length = 0;
            this.verticesClosedArea = {};

            return;
        }

        const ctrPoints = [...this.pointsCtrClosedArea];
        ctrPoints.push(ctrPoints[0]);

        const N = ctrPoints.length - 1;
        let t = new Array(N + 1).fill(0);

        switch (this.controlsParameters.closedAreaParams)
        {
            case "uniform":
                {
                    for (let i = 0; i <= N; ++i)
                    {
                        t[i] = i / N;
                    }
                    break;
                }
            case "chordal":
                {
                    let totalDist = 0;
                    let chordDist = [];

                    for (let i = 1; i <= N; ++i)
                    {
                        const du = ctrPoints[i].u - ctrPoints[i - 1].u;
                        const dv = ctrPoints[i].v - ctrPoints[i - 1].v;

                        const dist = Math.sqrt(du ** 2 + dv ** 2);
                        chordDist.push(dist);
                        totalDist += dist;
                    }

                    for (let i = 1; i <= N; ++i)
                    {
                        t[i] = t[i - 1] + chordDist[i - 1] / totalDist;
                    }
                    break;
                }
            case "centripetal":
                {
                    let totalDist = 0;
                    let centDist = [];

                    for (let i = 1; i <= N; ++i)
                    {
                        const du = ctrPoints[i].u - ctrPoints[i - 1].u;
                        const dv = ctrPoints[i].v - ctrPoints[i - 1].v;

                        const dist = Math.sqrt(Math.sqrt(du ** 2 + dv ** 2));
                        centDist.push(dist);
                        totalDist += dist;
                    }

                    for (let i = 1; i <= N; ++i)
                    {
                        t[i] = t[i - 1] + centDist[i - 1] / totalDist;
                    }
                    break;
                }
        }

        let [A, Bu, Bv] = this.createCyclicSystem(ctrPoints, t);
        let Mu = this.solveCyclicSystem(A, Bu);
        let Mv = this.solveCyclicSystem(A, Bv);

        Mu.unshift(Mu[Mu.length - 1]); // ???
        Mv.unshift(Mv[Mv.length - 1]);

        const M = Math.max(this.pointsCtrClosedArea.length, this.controlsParameters.closedAreaN);
        this.pointsClosedArea = [];

        for (let j = 0; j < M; ++j)
        {
            const T = t[0] + j / (M - 1) * (t[N] - t[0]);

            let k = 0;
            while (k < N && T > t[k + 1])
            {
                ++k;
            }

            k = Math.min(k, N - 1);
            const tau = T - t[k];
            const tk = t[k + 1] - t[k];

            let u = Mu[k] * Math.pow(t[k + 1] - T, 3) / (6 * tk) +
                Mu[k + 1] * Math.pow(tau, 3) / (6 * tk) +
                (ctrPoints[k].u - Mu[k] * (tk ** 2) / 6) * (t[k + 1] - T) / tk +
                (ctrPoints[k + 1].u - Mu[k + 1] * (tk ** 2) / 6) * tau / tk;
            u = utils.clamp(u, 0, 1);

            let v = Mv[k] * Math.pow(t[k + 1] - T, 3) / (6 * tk) +
                Mv[k + 1] * Math.pow(tau, 3) / (6 * tk) +
                (ctrPoints[k].v - Mv[k] * (tk ** 2) / 6) * (t[k + 1] - T) / tk +
                (ctrPoints[k + 1].v - Mv[k + 1] * (tk ** 2) / 6) * tau / tk;
            v = utils.clamp(v, 0, 1);

            const surfacePoint = this.evaluateNURBS(u, v, this.controlsParameters.degreeU, this.controlsParameters.degreeV);
            let point = new Point(surfacePoint.point.x, surfacePoint.point.y, surfacePoint.point.z);
            point.u = u;
            point.v = v;
            point.bStructured = true;

            this.pointsClosedArea.push(point);
        }

        this.createVerticesClosedArea();
    },

    cleanClosedAreaAndDraw: function () 
    {
        for (let i = 0; i < this.pointsTriangulation.length; ++i)
        {
            this.pointsTriangulation[i].select = false;
            this.verticesTriangulation[7 * i + 3] = false;
        }

        this.pointsCtrClosedArea = [];
        this.pointsClosedArea = [];

        this.calculateMeshAndDraw();
    },

    createVerticesCtrClosedArea: function ()
    {
        this.verticesCtrClosedArea = new Float32Array(this.pointsCtrClosedArea.length * 3);

        for (let i = 0; i < this.pointsCtrClosedArea.length; ++i)
        {
            let offset = 3 * i;
            this.verticesCtrClosedArea[offset] = this.pointsCtrClosedArea[i].x;
            this.verticesCtrClosedArea[offset + 1] = this.pointsCtrClosedArea[i].y;
            this.verticesCtrClosedArea[offset + 2] = this.pointsCtrClosedArea[i].z;
        }
    },

    createVerticesClosedArea: function ()
    {
        this.verticesClosedArea = new Float32Array(this.pointsClosedArea.length * 3);

        for (let i = 0; i < this.pointsClosedArea.length; ++i)
        {
            const offset = 3 * i;
            this.verticesClosedArea[offset] = this.pointsClosedArea[i].x;
            this.verticesClosedArea[offset + 1] = this.pointsClosedArea[i].y;
            this.verticesClosedArea[offset + 2] = this.pointsClosedArea[i].z;
        }
    },

    // CONSTRAINED TRIANGULATION

    calculateConstrainedTriangulation: function ()
    {
        if (this.pointsClosedArea == 0)
        {
            console.warn(`Can't calculate constrained triangulation with empty closed area.`)
            return;
        }

        let constrainedArea = new constraints.closedArea(this.pointsClosedArea);
        this.delaunayTriangulation.calculateConstraints(constrainedArea);

        this.updateTriangulationDrawBuffers();
    },
}

function mousedown(ev, canvas)
{
    ev = EventUtil.getEvent(ev);

    const x = ev.clientX; // x coordinate of a mouse pointer
    const y = ev.clientY; // y coordinate of a mouse pointer
    const rect = ev.target.getBoundingClientRect();

    Data.mousedownHandler(EventUtil.getButton(ev), x - rect.left, canvas.height - (y - rect.top));
}

function mouseup(ev, canvas)
{
    ev = EventUtil.getEvent(ev);

    const x = ev.clientX; // x coordinate of a mouse pointer
    const y = ev.clientY; // y coordinate of a mouse pointer
    const rect = ev.target.getBoundingClientRect();

    Data.mouseupHandler(EventUtil.getButton(ev), x - rect.left, canvas.height - (y - rect.top));
}

function mousemove(ev, canvas)
{
    const x = ev.clientX; // x coordinate of a mouse pointer
    const y = ev.clientY; // y coordinate of a mouse pointer
    const rect = ev.target.getBoundingClientRect();

    Data.mousemoveHandler(x - rect.left, canvas.height - (y - rect.top));
}

function dblclick(ev, canvas)
{
    const x = ev.clientX;
    const y = ev.clientY;
    const rect = ev.target.getBoundingClientRect();

    Data.dblClickHandler(x - rect.left, canvas.height - (y - rect.top));
}

window.onload = main;
