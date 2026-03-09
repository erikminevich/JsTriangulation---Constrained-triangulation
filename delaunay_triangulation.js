import { Point, Data } from './2.js';
import { utils, Edge, Triangle } from './delaunay_utils.js';
import { glMatrix, vec2, vec3, vec4, quat, mat2, mat3, mat4 } from './libs/dist/esm/index.js';

export class DefaultTriangulationStrategy
{
    constructor(_points, _renderer)
    {
        // rendering
        this.renderer = _renderer;
        // turn on/off step-by-step debug draw
        this.bDebug = false;

        this.freePoints = [..._points];
        this.triangles = [];
    }

    toString()
    {
        return "DefaultTriangulationStrategy::";
    }

    drawDebug()
    {
        if (this.bDebug)
        {
            this.renderer.updateTriangulationDrawBuffers();
            this.renderer.setVertexBuffersAndDraw();
        }
    }

    createSuperStructure()
    {
        let superPoints = [];
        let points = this.freePoints;

        for (let i = 0; i < points.length;)
        {
            if ((points[i].u == 0 || points[i].u == 1) && (points[i].v == 0 || points[i].v == 1))
            {
                // console.log(`Super point: ${points[i]}`);

                superPoints.push(points[i]);
                points.splice(i, 1);
            }
            else
            {
                ++i;
            }
        }

        // TODO: handle correctness and different corner cases?
        let triangle1 = new Triangle(superPoints[0], superPoints[1], superPoints[2]);
        let triangle2 = new Triangle(superPoints[1], superPoints[2], superPoints[3]);

        let adjEdge = triangle1.getAdjEdge(triangle2);
        if (!adjEdge)
        {
            console.error(`${this}: Created triangles are not adjacent: 1: ${triangle1}, 2: ${triangle2}`);
            return;
        }

        let oppositePoint = triangle1.getOppositePoint(adjEdge);
        triangle1.setAdjTriangle(oppositePoint, triangle2);

        triangle1.id = this.triangles.length;
        this.triangles.push(triangle1);
        triangle2.id = this.triangles.length;
        this.triangles.push(triangle2);

        this.drawDebug();
    }

    calculate()
    {
        this.createSuperStructure();

        let points = this.freePoints;
        utils.shuffleArray(points);

        while (points.length > 0)
        {
            let curPoint = points.pop();
            let closestTriangle = this.findClosestTriangle(curPoint);
            if (!closestTriangle)
            {
                console.warn(`${this}: Failed to find closest triangle for ${curPoint}`);
                continue;
            }

            this.insertPoint(curPoint, closestTriangle);

            this.drawDebug();
        }
    }

    // new point localization inside current triangulation
    findClosestTriangle(_point)
    {
        for (let i = 0; i < this.triangles.length; ++i)
        {
            if (this.triangles[i].containsPoint(_point))
            {
                return this.triangles[i];
            }
        }

        return null;
    }

    insertPoint(_point, _triangle)
    {
        if (_triangle.isOuterPoint(_point))
        {
            // do nothing
            return;
        }

        if (_triangle.isVertexPoint(_point))
        {
            // do nothing
            return;
        }

        let edge = _triangle.isEdgePoint(_point);
        if (edge)
        {
            if (_point.bStructured)
            {
                this.renderer.pointsTriangulation.push(_point);
                this.renderer.normalsTriangulation.push({ x: 0, y: 0, z: 0 });
            }

            this.splitEdge(_triangle, edge, _point);

            return;
        }

        if (_triangle.isInnerPoint(_point))
        {
            if (_point.bStructured)
            {
                this.renderer.pointsTriangulation.push(_point);
                this.renderer.normalsTriangulation.push({ x: 0, y: 0, z: 0 });
            }

            this.splitTriangle(_triangle, _point);

            return;
        }

        console.warn(`${_triangle}: need algorithm to handle outer point ${_point}.`);
    }

    insertEdge(_edge)
    {
        let triangle = this.findClosestTriangle(_edge.v1);
        if (!triangle)
        {
            console.error(`${this}: Couldn't find closest triangle during insertion of ${_edge}.`);
            return;
        }

        let crossEdge = new Edge(_edge.v1, _edge.v2);

        // find first double-crossed edge
        let allCrossPoints = [];
        let localCrossPoints = triangle.getCrossPoints(crossEdge);

        // TODO: check localCrossPoints.length == 0
        allCrossPoints.push(localCrossPoints[0]);

        // go to the end point
        let tmpEdge = new Edge();
        while (!triangle.isVertexPoint(crossEdge.v2))
        {
            localCrossPoints = triangle.getCrossPoints(crossEdge);

            // in case that crossEdge cross only 1 vertice
            let bFanSearch = localCrossPoints.length == 1;
            if (bFanSearch)
            {
                let idxDelta = 1;
                while (localCrossPoints.length != 2)
                {
                    let idx = triangle.indexOfPoint(crossEdge.v1);
                    if (idx == -1)
                    {
                        console.error(`${this}: Fail during fan-search in ${triangle} around point ${crossEdge.v1}.`)
                    }

                    let adjTriangle = triangle.getAdjTriangle(triangle.vertices[((idx + idxDelta) % 3 + 3) % 3]);
                    if (!adjTriangle)
                    {
                        if (idxDelta == 1)
                        {
                            // try to search in counter-ordering (clock-wise <-> counter clock-wise)
                            idxDelta = -1;
                            localCrossPoints = [];
                            continue;
                        }
                        else if (idxDelta == -1)
                        {
                            console.error(`${this}: Fail during fan-search in ${triangle} around point ${crossEdge.v1}.`);
                        }
                    }

                    triangle = adjTriangle;
                    localCrossPoints = triangle.getCrossPoints(crossEdge);
                }
            }

            let idx = triangle.indexOfPoint(localCrossPoints[0]);
            if (idx != -1)
            {
                if (!triangle.isVertexPoint(crossEdge.v2))
                {
                    triangle = triangle.getAdjTriangle(triangle.vertices[idx]);
                }
            }
            else
            {
                let adjIdx = -1;
                for (let i = 0; i < triangle.vertices.length; ++i)
                {
                    tmpEdge.v1 = triangle.vertices[i];
                    tmpEdge.v2 = triangle.vertices[(i + 1) % 3];

                    if (tmpEdge.isInnerPoint(localCrossPoints[1]))
                    {
                        let adjTriangle = triangle.getAdjTriangle(triangle.vertices[(i + 2) % 3]);
                        if (!adjTriangle)
                        {
                            continue;
                        }

                        adjIdx = adjTriangle.id;
                        break;
                    }
                }

                if (adjIdx == -1)
                {
                    console.error(`${this}: Couldn't find next triangle from ${triangle} to insert edge ${_edge}.`);
                    break;
                }

                triangle = adjIdx == -1 ? null : this.triangles[adjIdx];
            }

            crossEdge.v1 = localCrossPoints[1];
            allCrossPoints.push(localCrossPoints[1]);

            if (!triangle)
            {
                console.error(`${this}: Couldn't find next triangle to insert edge ${_edge}.`);
                break;
            }
        }

        return allCrossPoints;
    }

    // split cur triangle's edge with point
    splitEdge(_triangle, _edge, _point)
    {
        let oppositePoint = _triangle.getOppositePoint(_edge);
        if (!oppositePoint)
        {
            console.error(`${this}: There isn't opposite point in ${_triangle} during splitting it's edge ${_edge}.`);
            return;
        }

        // new edge - [oppositePoint, _point]
        let triangle1 = new Triangle(oppositePoint, _point, _edge.v1);
        let triangle2 = new Triangle(oppositePoint, _point, _edge.v2);

        triangle1.setAdjTriangle(_point, _triangle.getAdjTriangle(_edge.v2));
        triangle1.setAdjTriangle(_edge.v1, triangle2);

        triangle2.setAdjTriangle(_point, _triangle.getAdjTriangle(_edge.v1));
        triangle2.setAdjTriangle(_edge.v2, triangle1);

        let adjTriangle = _triangle.getAdjTriangle(oppositePoint);

        triangle1.id = _triangle.id;
        this.triangles[_triangle.id] = triangle1;
        triangle2.id = this.triangles.length;
        this.triangles.push(triangle2);

        this.drawDebug();

        // may not exist if edge is triangulation border
        if (!adjTriangle)
        {
            this.checkDelaunayCorrectness([triangle1, triangle2]);
            return;
        }

        let adjOppositePoint = adjTriangle.getOppositePoint(_edge);
        if (!adjOppositePoint)
        {
            console.error(`${this}: There isn't point in adjacent triangle ${adjTriangle} opposite to ${_edge}. Splitted triangle ${_triangle}.`);
            return;
        }

        let triangle3 = new Triangle(adjOppositePoint, _point, _edge.v1);
        let triangle4 = new Triangle(adjOppositePoint, _point, _edge.v2);

        triangle3.setAdjTriangle(_point, adjTriangle.getAdjTriangle(_edge.v2));
        triangle4.setAdjTriangle(_point, adjTriangle.getAdjTriangle(_edge.v1));
        triangle3.setAdjTriangle(_edge.v1, triangle4);

        triangle1.setAdjTriangle(oppositePoint, triangle3);
        triangle2.setAdjTriangle(oppositePoint, triangle4);

        triangle3.id = adjTriangle.id;
        this.triangles[adjTriangle.id] = triangle3;
        triangle4.id = this.triangles.length;
        this.triangles.push(triangle4);

        this.drawDebug();

        this.checkDelaunayCorrectness([triangle1, triangle2, triangle3, triangle4]);
    }

    // split cur triangle with inner point
    splitTriangle(_triangle, _point)
    {
        let triangle1 = new Triangle(_triangle.v1, _triangle.v2, _point);
        let triangle2 = new Triangle(_triangle.v2, _triangle.v3, _point);
        let triangle3 = new Triangle(_triangle.v3, _triangle.v1, _point);

        triangle1.setAdjTriangle(_triangle.v1, triangle2);
        triangle2.setAdjTriangle(_triangle.v2, triangle3);
        triangle3.setAdjTriangle(_triangle.v3, triangle1);

        triangle1.setAdjTriangle(_point, _triangle.getAdjTriangle(_triangle.v3));
        triangle2.setAdjTriangle(_point, _triangle.getAdjTriangle(_triangle.v1));
        triangle3.setAdjTriangle(_point, _triangle.getAdjTriangle(_triangle.v2));

        triangle1.id = _triangle.id;
        this.triangles[_triangle.id] = triangle1;
        triangle2.id = this.triangles.length;
        this.triangles.push(triangle2);
        triangle3.id = this.triangles.length;
        this.triangles.push(triangle3);

        this.drawDebug();

        this.checkDelaunayCorrectness([triangle1, triangle2, triangle3]);
    }

    eraseTriangle(_triangle)
    {
        // not complete erasing, just nullify triangle and adj refs
        let adjTriangles = [...this.triangles[_triangle.id].adjTriangles];

        for (let i = 0; i < adjTriangles.length; ++i)
        {
            if (!adjTriangles[i])
            {
                continue;
            }

            for (let j = 0; j < adjTriangles[i].adjTriangles.length; ++j)
            {
                let adjAdjTriangle = adjTriangles[i].adjTriangles[j];
                if (adjAdjTriangle && adjAdjTriangle.id == _triangle.id)
                {
                    adjTriangles[i].adjTriangles[j] = null;
                    break;
                }
            }
        }
        this.triangles[_triangle.id] = null;
    }

    flipTriangles(_triangle1, _triangle2)
    {
        let adjEdge = _triangle1.getAdjEdge(_triangle2);
        if (!adjEdge)
        {
            console.error(`${this}: Trying to flip 2 non-adjacent triangles: ${_triangle1} and ${_triangle2}`);
            return [];
        }

        let oppositePoint1 = _triangle1.getOppositePoint(adjEdge);
        let oppositePoint2 = _triangle2.getOppositePoint(adjEdge);

        let triangle3 = new Triangle(adjEdge.v1, oppositePoint1, oppositePoint2);
        let triangle4 = new Triangle(adjEdge.v2, oppositePoint1, oppositePoint2);

        triangle3.setAdjTriangle(adjEdge.v1, triangle4);
        triangle3.setAdjTriangle(oppositePoint1, _triangle2.getAdjTriangle(adjEdge.v2));
        triangle3.setAdjTriangle(oppositePoint2, _triangle1.getAdjTriangle(adjEdge.v2));
        triangle4.setAdjTriangle(oppositePoint1, _triangle2.getAdjTriangle(adjEdge.v1));
        triangle4.setAdjTriangle(oppositePoint2, _triangle1.getAdjTriangle(adjEdge.v1));

        triangle3.id = _triangle1.id;
        this.triangles[_triangle1.id] = triangle3;

        triangle4.id = _triangle2.id;
        this.triangles[_triangle2.id] = triangle4;

        this.drawDebug();

        return [triangle4, triangle3];
    }

    // check Delaunay correctness for 2 triangles
    checkSingleDelaunayCorrectness(_triangle1, _triangle2)
    {
        let adjEdge = _triangle1.getAdjEdge(_triangle2);
        if (adjEdge)
        {
            // TODO: is it the right place for that?
            if (adjEdge.isStructured())
            {
                return true;
            }

            let oppositePoint1 = _triangle1.getOppositePoint(adjEdge);
            let oppositePoint2 = _triangle2.getOppositePoint(adjEdge);

            // TODO: maybe not entirely correct, but handle flipTriangles stack-in-loop
            return _triangle1.isDelaunayCorrect(oppositePoint2) || _triangle2.isDelaunayCorrect(oppositePoint1);
        }
        else
        {
            for (let i = 0; i < _triangle2.vertices.length; ++i)
            {
                if (!_triangle1.isDelaunayCorrect(_triangle2.vertices[i]))
                {
                    return false;
                }
            }
        }

        return true;
    }

    // check Delaunay correctness for array of triangles
    checkDelaunayCorrectness(_checkTriangles)
    {
        while (_checkTriangles.length > 0)
        {
            // pop first element
            let curTriangle = _checkTriangles.shift();

            let adjTriangles = curTriangle.getAdjTriangles();
            for (let i = 0; i < adjTriangles.length; ++i)
            {
                if (!adjTriangles[i])
                {
                    continue;
                }

                if (!this.checkSingleDelaunayCorrectness(curTriangle, adjTriangles[i]))
                {
                    let idx = _checkTriangles.indexOf(adjTriangles[i]);
                    if (idx != -1)
                    {
                        _checkTriangles.splice(idx, 1);
                    }

                    let flippedTriangles = this.flipTriangles(curTriangle, adjTriangles[i]);
                    _checkTriangles.push(...flippedTriangles);
                    break;
                }
            }
        }
    }

    calculateConstraints(_constraint)
    {
        this.bDebug = false;
        console.log(`Calculating constraints...`);

        // 1 step: insert all structured points 
        for (let i = 0; i < _constraint.points.length; ++i)
        {
            let curPoint = _constraint.points[i];
            let closestTriangle = this.findClosestTriangle(curPoint);
            if (!closestTriangle)
            {
                console.warn(`${this}: Failed to find closest triangle for ${curPoint}`);
                continue;
            }

            this.insertPoint(curPoint, closestTriangle);

            this.drawDebug();
        }

        // 2 step: insert all structured edges
        let constrainedPoints = _constraint.points;
        let N = constrainedPoints.length;
        for (let j = 0; j < N; ++j)
        {
            let constrainedEdge = new Edge(constrainedPoints[j], constrainedPoints[(j + 1) % N]);
            // TODO: rework: split insertEdge logic, should it return new crossPoints???
            let crossPoints = this.insertEdge(constrainedEdge);
            for (let k = 0; k < crossPoints.length; ++k)
            {
                crossPoints[k].bStructured = true;

                let closestTriangle = this.findClosestTriangle(crossPoints[k]);
                if (!closestTriangle)
                {
                    console.error(`${this}: Failed to find closest triangle for constained point ${crossPoints[k]}`);
                    continue;
                }

                this.insertPoint(crossPoints[k], closestTriangle);
                this.drawDebug();
            }

            this.drawDebug();
        }

        // 3 step: delete all triangles inside constraints
        // most simple one
        for (let i = this.triangles.length - 1; i >= 0; --i)
        {
            // TODO: rework with more complex algo ???
            if (_constraint.containsTriangle(this.triangles[i]))
            {
                this.eraseTriangle(this.triangles[i]);
                this.drawDebug();
            }
        }

        this.bDebug = false;
    }
}

export class DynamicCachingTriangulationStrategy extends DefaultTriangulationStrategy
{
    #DynamicCache = class
    {
        constructor(_trigStrategy, _size = 2)
        {
            // cache: size x size matrix
            this.size = _size;
            // (max - min) / size - cell step in cache
            this.cellSize = 1.0 / this.size;
            // empty on the start (ids of triangulation elements)
            this.cache = null;

            // cache growth coefficient
            this.rCoef = 5;

            this.trigStrategy = _trigStrategy;
        }

        toString()
        {
            return JSON.stringify({ size: this.size, rCoef: this.rCoef, cellSize: this.cellSize }, null, 2);
        }

        getCellCentoid(_i, _j)
        {
            if (!this.cache)
            {
                console.warn(`${this}: Cache is empty, should insert element first`);
                return null;
            }

            if (!utils.between(_i, 0, this.size - 1) || !utils.between(_j, 0, this.size - 1))
            {
                console.error(`${this}: Invalid indices [${_i},${_j}] during getCellCentroid()`);
                return null;
            }

            return {
                u: _i * this.cellSize + this.cellSize * 0.5,
                v: _j * this.cellSize + this.cellSize * 0.5
            };
        }

        getResizeLimit()
        {
            return this.rCoef * this.size ** 2;
        }

        at(_i, _j)
        {
            if (!this.cache)
            {
                console.warn(`${this}: Cache is empty, should insert element first`);
                return null;
            }

            if (!utils.between(_i, 0, this.size - 1) || !utils.between(_j, 0, this.size - 1))
            {
                console.error(`${this}: Invalid indices [${_i},${_j}] during at()`);
                return null;
            }

            let id = this.cache[_i * this.size + _j];
            return this.trigStrategy.triangles[id];
        }

        indexOf(_point)
        {
            if (!this.cache)
            {
                console.warn(`${this}: Cache is empty, should insert element first`);
                return null;
            }

            // TODO: clamp because of upper bound coordinate gives index this.size
            return [utils.clamp(Math.floor(_point.u / this.cellSize), 0, this.size - 1), utils.clamp(Math.floor(_point.v / this.cellSize), 0, this.size - 1)];
        }

        insert(_triangle)
        {
            if (!this.cache)
            {
                this.cache = new Array(this.size * this.size);
                for (let k = 0; k < this.size; ++k)
                {
                    for (let l = 0; l < this.size; ++l)
                    {
                        this.cache[k * this.size + l] = _triangle.id;
                    }
                }

                return;
            }

            let centroid = _triangle.getCentroid();
            let [i, j] = this.indexOf(centroid);

            let cellTriangle = this.at(i, j);
            if (!cellTriangle)
            {
                console.error(`${this}: Invalid triangle in cache during insert ${_triangle}`);
                return;
            }

            if (cellTriangle === _triangle)
            {
                return;
            }

            let cellCentroid = this.getCellCentoid(i, j);
            let curCentroid = cellTriangle.getCentroid();

            let curDist = (curCentroid.u - cellCentroid.u) ** 2 + (curCentroid.v - cellCentroid.v) ** 2;
            let newDist = (centroid.u - cellCentroid.u) ** 2 + (centroid.v - cellCentroid.v) ** 2;

            if (newDist < curDist)
            {
                this.cache[i * this.size + j] = _triangle.id;
            }
        }

        resize()
        {
            console.log(`CACHE RESIZE to ${this.size * 2} x ${this.size * 2}`);

            let newSize = this.size * 2;
            let newCache = new Array(newSize * newSize);

            for (let i = 0; i < this.size; ++i)
            {
                for (let j = 0; j < this.size; ++j)
                {
                    newCache[2 * i * newSize + 2 * j] = this.cache[i * this.size + j];
                    newCache[2 * i * newSize + 2 * j + 1] = this.cache[i * this.size + j];
                    newCache[(2 * i + 1) * newSize + 2 * j] = this.cache[i * this.size + j];
                    newCache[(2 * i + 1) * newSize + 2 * j + 1] = this.cache[i * this.size + j];
                }
            }

            this.size = newSize;
            this.cellSize = 1.0 / this.size;
            this.cache = newCache;
        }
    };

    constructor(_points, _renderer)
    {
        super(_points, _renderer);

        // dynamic cache
        this.pointsCount = 0;
        this.dynamicCache = new this.#DynamicCache(this);
    }

    toString()
    {
        return "DynamicCacheingTriangulationStrategy::";
    }

    createSuperStructure()
    {
        let superPoints = [];
        let points = this.freePoints;

        for (let i = 0; i < points.length;)
        {
            if ((points[i].u == 0 || points[i].u == 1) && (points[i].v == 0 || points[i].v == 1))
            {
                // console.log(`Super point: ${points[i]}`);

                superPoints.push(points[i]);
                points.splice(i, 1);
            }
            else
            {
                ++i;
            }
        }

        let triangle1 = new Triangle(superPoints[0], superPoints[1], superPoints[2]);
        let triangle2 = new Triangle(superPoints[1], superPoints[2], superPoints[3]);

        let adjEdge = triangle1.getAdjEdge(triangle2);
        if (!adjEdge)
        {
            console.error(`${this}: Created triangles are not adjacent: ${triangle1} and ${triangle2}.`);
            return;
        }

        let oppositePoint = triangle1.getOppositePoint(adjEdge);
        triangle1.setAdjTriangle(oppositePoint, triangle2);

        triangle1.id = this.triangles.length;
        this.triangles.push(triangle1);
        this.dynamicCache.insert(triangle1);

        triangle2.id = this.triangles.length;
        this.triangles.push(triangle2);
        this.dynamicCache.insert(triangle2);

        this.drawDebug();

        this.pointsCount += 4;
        if (this.pointsCount >= this.dynamicCache.getResizeLimit())
        {
            this.dynamicCache.resize();
        }
    }

    calculate()
    {
        this.createSuperStructure();

        let points = this.freePoints;
        utils.shuffleArray(points);

        while (points.length > 0)
        {
            let curPoint = points.pop();
            let closestTriangle = this.findClosestTriangle(curPoint);
            if (!closestTriangle)
            {
                console.warn(`${this}: Failed to find closest triangle for ${curPoint}`);
                continue;
            }

            // update triangle for cache
            this.dynamicCache.insert(closestTriangle);
            this.insertPoint(curPoint, closestTriangle);

            this.drawDebug();
        }
    }

    findClosestTriangle(_point)
    {
        let [i, j] = this.dynamicCache.indexOf(_point);

        let cellTriangle = this.dynamicCache.at(i, j);
        if (!cellTriangle)
        {
            console.error(`${this}: Invalid triangle in dynamic cache`);
            return null;
        }

        let edge = new Edge();
        let closestTriangle = cellTriangle;
        while (!closestTriangle.containsPoint(_point))
        {
            let centroid = closestTriangle.getCentroid();
            let pointDir = new Edge(centroid, _point);

            let adjTriangle = closestTriangle;
            for (let k = 0; k < closestTriangle.vertices.length; ++k)
            {
                edge.v1 = closestTriangle.vertices[k];
                edge.v2 = closestTriangle.vertices[(k + 1) % 3];

                if (pointDir.isCrossed(edge))
                {
                    adjTriangle = closestTriangle.getAdjTriangle(closestTriangle.vertices[(k + 2) % 3]);
                    break;
                }
            }

            // TODO: robust fix for 'no crossed edges' problem (vectors are collinear because of EPS)
            // go to next random adj triangle and continue
            if (adjTriangle == closestTriangle)
            {
                console.error(`${this}: Couldn't find next triangle from ${closestTriangle} to ${_point}.`);

                adjTriangle = null;
                while (!adjTriangle)
                {
                    // rand index: 0, 1, 2
                    let randIdx = Math.floor(Math.random() * (2 - 0 + 1)) + 0;
                    adjTriangle = closestTriangle.adjTriangles[randIdx];
                }
            }
            closestTriangle = adjTriangle;
        }

        return closestTriangle;
    }

    insertPoint(_point, _triangle)
    {
        if (_triangle.isOuterPoint(_point))
        {
            // do nothing
            return false;
        }

        if (_triangle.isVertexPoint(_point))
        {
            // do nothing
            return false;
        }

        let edge = _triangle.isEdgePoint(_point);
        if (edge)
        {
            this.pointsCount++;
            if (this.pointsCount >= this.dynamicCache.getResizeLimit())
            {
                this.dynamicCache.resize();
            }

            if (_point.bStructured)
            {
                this.renderer.pointsTriangulation.push(_point);
                this.renderer.normalsTriangulation.push({ x: 0, y: 0, z: 0 });
            }

            this.splitEdge(_triangle, edge, _point);

            return true;
        }

        if (_triangle.isInnerPoint(_point))
        {
            this.pointsCount++;
            if (this.pointsCount >= this.dynamicCache.getResizeLimit())
            {
                this.dynamicCache.resize();
            }

            if (_point.bStructured)
            {
                this.renderer.pointsTriangulation.push(_point);
                this.renderer.normalsTriangulation.push({ x: 0, y: 0, z: 0 });
            }

            this.splitTriangle(_triangle, _point);

            return true;
        }

        console.warn(`${this}: need algorithm to handle inner-outer point ${_point} for ${_triangle}.`);
        return false;
    }

    // split cur triangle's edge with point
    splitEdge(_triangle, _edge, _point)
    {
        let oppositePoint = _triangle.getOppositePoint(_edge);
        if (!oppositePoint)
        {
            console.error(`${this}: There isn't opposite point in ${_triangle} during splitting it's edge ${_edge}.`);
            return;
        }

        // new edge - [oppositePoint, _point]
        let triangle1 = new Triangle(oppositePoint, _point, _edge.v1);
        let triangle2 = new Triangle(oppositePoint, _point, _edge.v2);

        triangle1.setAdjTriangle(_point, _triangle.getAdjTriangle(_edge.v2));
        triangle1.setAdjTriangle(_edge.v1, triangle2);

        triangle2.setAdjTriangle(_point, _triangle.getAdjTriangle(_edge.v1));
        triangle2.setAdjTriangle(_edge.v2, triangle1);

        let adjTriangle = _triangle.getAdjTriangle(oppositePoint);

        triangle1.id = _triangle.id;
        this.triangles[_triangle.id] = triangle1;

        triangle2.id = this.triangles.length;
        this.triangles.push(triangle2);
        this.dynamicCache.insert(triangle2)

        this.drawDebug();

        // may not exist if edge is triangulation border
        if (!adjTriangle)
        {
            this.checkDelaunayCorrectness([triangle1, triangle2]);
            return;
        }

        let adjOppositePoint = adjTriangle.getOppositePoint(_edge);
        if (!adjOppositePoint)
        {
            console.error(`${this}: There isn't point in adjacent triangle ${adjTriangle} opposite to ${_edge}. Splitted triangle ${_triangle}.`);
            return;
        }

        let triangle3 = new Triangle(adjOppositePoint, _point, _edge.v1);
        let triangle4 = new Triangle(adjOppositePoint, _point, _edge.v2);

        triangle3.setAdjTriangle(_point, adjTriangle.getAdjTriangle(_edge.v2));
        triangle4.setAdjTriangle(_point, adjTriangle.getAdjTriangle(_edge.v1));
        triangle3.setAdjTriangle(_edge.v1, triangle4);

        triangle1.setAdjTriangle(oppositePoint, triangle3);
        triangle2.setAdjTriangle(oppositePoint, triangle4);

        triangle3.id = adjTriangle.id;
        this.triangles[adjTriangle.id] = triangle3;

        triangle4.id = this.triangles.length;
        this.triangles.push(triangle4);
        this.dynamicCache.insert(triangle4);

        this.drawDebug();

        this.checkDelaunayCorrectness([triangle1, triangle2, triangle3, triangle4]);
    }

    // split cur triangle with inner point
    splitTriangle(_triangle, _point)
    {
        let triangle1 = new Triangle(_triangle.v1, _triangle.v2, _point);
        let triangle2 = new Triangle(_triangle.v2, _triangle.v3, _point);
        let triangle3 = new Triangle(_triangle.v3, _triangle.v1, _point);

        triangle1.setAdjTriangle(_triangle.v1, triangle2);
        triangle2.setAdjTriangle(_triangle.v2, triangle3);
        triangle3.setAdjTriangle(_triangle.v3, triangle1);

        triangle1.setAdjTriangle(_point, _triangle.getAdjTriangle(_triangle.v3));
        triangle2.setAdjTriangle(_point, _triangle.getAdjTriangle(_triangle.v1));
        triangle3.setAdjTriangle(_point, _triangle.getAdjTriangle(_triangle.v2));

        triangle1.id = _triangle.id;
        this.triangles[_triangle.id] = triangle1;

        triangle2.id = this.triangles.length;
        this.triangles.push(triangle2);
        this.dynamicCache.insert(triangle2);

        triangle3.id = this.triangles.length;
        this.triangles.push(triangle3);
        this.dynamicCache.insert(triangle3);

        this.drawDebug();

        this.checkDelaunayCorrectness([triangle1, triangle2, triangle3]);
    }

    flipTriangles(_triangle1, _triangle2)
    {
        let adjEdge = _triangle1.getAdjEdge(_triangle2);
        if (!adjEdge)
        {
            console.error(`${this}: Trying to flip 2 non-adjacent triangles: ${_triangle1} and ${_triangle2}`);
            return [];
        }

        let oppositePoint1 = _triangle1.getOppositePoint(adjEdge);
        let oppositePoint2 = _triangle2.getOppositePoint(adjEdge);

        let triangle3 = new Triangle(adjEdge.v1, oppositePoint1, oppositePoint2);
        let triangle4 = new Triangle(adjEdge.v2, oppositePoint1, oppositePoint2);

        triangle3.setAdjTriangle(adjEdge.v1, triangle4);
        triangle3.setAdjTriangle(oppositePoint1, _triangle2.getAdjTriangle(adjEdge.v2));
        triangle3.setAdjTriangle(oppositePoint2, _triangle1.getAdjTriangle(adjEdge.v2));
        triangle4.setAdjTriangle(oppositePoint1, _triangle2.getAdjTriangle(adjEdge.v1));
        triangle4.setAdjTriangle(oppositePoint2, _triangle1.getAdjTriangle(adjEdge.v1));

        triangle3.id = _triangle1.id;
        this.triangles[_triangle1.id] = triangle3;

        triangle4.id = _triangle2.id;
        this.triangles[_triangle2.id] = triangle4;

        this.drawDebug();

        return [triangle4, triangle3];
    }
}