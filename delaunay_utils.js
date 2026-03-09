import { Point } from './2.js';
import { glMatrix, vec2, vec3, vec4, quat, mat2, mat3, mat4 } from './libs/dist/esm/index.js';

export const utils = {

    EPS: 1e-6,

    clamp: function (value, min, max)
    {
        return Math.min(Math.max(value, min), max);
    },

    between: function (value, min, max)
    {
        // need handle some EPS-area around value
        if (Math.abs(min - value) < utils.EPS || (Math.abs(max - value) < utils.EPS))
        {
            return true;
        }

        return value >= min && value <= max;
    },

    shuffleArray: function (_array)
    {
        for (let i = _array.length - 1; i > 0; i--)
        {
            const j = Math.floor(Math.random() * (i + 1));
            [_array[i], _array[j]] = [_array[j], _array[i]];
        }
    },

    // get vector from 2 points
    vec2d: function (_point1, _point2)
    {
        return { u: _point2.u - _point1.u, v: _point2.v - _point1.v };
    },

    // cross multiply for 2 vectors
    cross2d: function (_vec1, _vec2)
    {
        return _vec1.u * _vec2.v - _vec2.u * _vec1.v;
    },

    // scalar multiply for 2 vectors
    dot2d: function (_vec1, _vec2)
    {
        return _vec1.u * _vec2.u + _vec1.v * _vec2.v;
    }
}

export class Edge
{
    constructor(_v1 = null, _v2 = null)
    {
        this.v1 = _v1;
        this.v2 = _v2;
    }

    toString()
    {
        return JSON.stringify({ v1: this.v1, v2: this.v2 }, null, 2);
    }

    isVertexPoint(_point)
    {
        let vertices = [this.v1, this.v2];
        for (let i = 0; i < vertices.length; ++i)
        {
            if (_point == vertices[i] ||
                (Math.abs(_point.u - vertices[i].u) < utils.EPS && Math.abs(_point.v - vertices[i].v) < utils.EPS))
            {
                // TODO: BAD PLACE FOR THAT
                vertices[i].bStructured = _point.bStructured;

                return true;
            }
        }

        return false;
    }

    isInnerPoint(_point)
    {
        if (this.isVertexPoint(_point))
        {
            return true;
        }

        let vec1 = utils.vec2d(_point, this.v1);
        let vec2 = utils.vec2d(_point, this.v2);

        let crossValue = utils.cross2d(vec1, vec2);
        if (Math.abs(crossValue) > utils.EPS)
        {
            return false;
        }

        return utils.between(_point.u, Math.min(this.v1.u, this.v2.u), Math.max(this.v1.u, this.v2.u)) &&
            utils.between(_point.v, Math.min(this.v1.v, this.v2.v), Math.max(this.v1.v, this.v2.v));
    }

    isCollinear(_edge)
    {
        let AB = utils.vec2d(this.v1, this.v2);
        let CD = utils.vec2d(_edge.v1, _edge.v2);

        return Math.abs(utils.cross2d(AB, CD)) < utils.EPS;
    }

    isCrossed(_edge)
    {
        return this.getCrossPoint(_edge) != null;
    }

    getCrossPoint(_edge)
    {
        if (this.isCollinear(_edge))
        {
            return null;
        }

        // AB: t in [0, 1]
        // u = this.v1.u + AB.u * t
        // v = this.v1.v + AB.v * t
        let AB = { u: this.v2.u - this.v1.u, v: this.v2.v - this.v1.v };

        // CD: s in [0, 1]
        // u = _edge.v1.u + CD.u * s
        // v = _edge.v1.v + CD.v * s
        let CD = { u: _edge.v2.u - _edge.v1.u, v: _edge.v2.v - _edge.v1.v };

        // 2 x 2 system -> { t, s }
        // this.v1.u + AB.u * t = _edge.v1.u + CD.u * s
        // this.v1.v + AB.v * t = _edge.v1.v + CD.v * s

        // AB.u * t - CD.u * s = _edge.v1.u - this.v1.u
        // AB.v * t - CD.v * s = _edge.v1.v - this.v1.v
        let cu = _edge.v1.u - this.v1.u;
        let cv = _edge.v1.v - this.v1.v;

        // t0 = detT / det;
        // s0 = detS / det;

        // det
        // | AB.u -CD.u |
        // | AB.v -CD.v |
        let det = AB.u * (-CD.v) + CD.u * AB.v;
        if (Math.abs(det) < utils.EPS)
        {
            console.error(`${this}: System's det is zero during cross-point evaluation with ${_edge}.`);
            return null;
        }

        // detT
        // | cu -CD.u |
        // | cv -CD.v |
        let detT = cu * (-CD.v) + CD.u * cv;

        // detS
        // | AB.u cu |
        // | AB.v cv |
        let detS = AB.u * cv - cu * AB.v;

        let t0 = detT / det;
        let s0 = detS / det;

        if (!(utils.between(t0, 0 - utils.EPS, 1 + utils.EPS) && utils.between(s0, 0 - utils.EPS, 1 + utils.EPS)))
        {
            return null;
        }

        // dont allow eps to affect on point
        t0 = utils.clamp(t0, 0, 1);
        s0 = utils.clamp(s0, 0, 1);

        const x = this.v1.x + (this.v2.x - this.v1.x) * t0;
        const y = this.v1.y + (this.v2.y - this.v1.y) * t0;
        const z = this.v1.z + (this.v2.z - this.v1.z) * t0;

        let crossPoint = new Point(x, y, z);
        crossPoint.u = this.v1.u + AB.u * t0;
        crossPoint.v = this.v1.v + AB.v * t0;
        crossPoint.bStructured = this.isStructured() || _edge.isStructured();

        return crossPoint;
    }

    getCrossInterval(_edge)
    {
        if (!this.isCollinear(_edge))
        {
            console.warn(`${this}: Not collinear with ${_edge}`);
            return [];
        }

        let AB = utils.vec2d(this.v1, this.v2);

        let cDir = utils.vec2d(this.v1, _edge.v1);
        let dDir = utils.vec2d(this.v1, _edge.v2);

        // lying on the same line
        if (Math.abs(utils.cross2d(cDir, dDir)) >= utils.EPS) 
        {
            console.warn(`${this}: Not lying on the same line with ${_edge}`);
            return [];
        }

        // parameter for A, B (this.v1 and this.v2) and C, D (_edge's v1 and v2) inside AB
        let aT = 0;
        let bT = 1;
        let cT = AB.u != 0 ? cDir.u / AB.u : cDir.v / AB.v;
        let dT = AB.u != 0 ? dDir.u / AB.u : dDir.v / AB.v;

        // no common points
        if (Math.max(cT, dT) < aT || Math.min(cT, dT) > bT)
        {
            return [];
        }

        let leftT = utils.clamp(Math.min(cT, dT), aT, bT);
        let rightT = utils.clamp(Math.max(cT, dT), aT, bT);

        let leftPoint = new Point(this.v1.x + (this.v2.x - this.v1.x) * leftT, this.v1.y + (this.v2.y - this.v1.y) * leftT, this.v1.z + (this.v2.z - this.v1.z) * leftT);
        leftPoint.u = this.v1.u + AB.u * leftT;
        leftPoint.v = this.v1.v + AB.u * leftT;
        leftPoint.bStructured = this.isStructured() || _edge.isStructured()

        let rightPoint = new Point(this.v1.x + (this.v2.x - this.v1.x) * rightT, this.v1.y + (this.v2.y - this.v1.y) * rightT, this.v1.z + (this.v2.z - this.v1.z) * rightT);
        rightPoint.u = this.v1.u + AB.u * rightT;
        rightPoint.v = this.v1.v + AB.u * rightT;
        rightPoint.bStructured = this.isStructured() || _edge.isStructured();

        return [leftPoint, rightPoint];

    }

    // is edge is structured (non-changable) in triangulation
    isStructured()
    {
        return this.v1.bStructured && this.v2.bStructured;
    }
}

export class Triangle
{
    constructor(_v1, _v2, _v3)
    {
        this.vertices = this.sort([_v1, _v2, _v3]);
        this.v1 = this.vertices[0];
        this.v2 = this.vertices[1];
        this.v3 = this.vertices[2];

        this.adjTriangles = new Array(3);

        // for circumcircle
        this.radiusSq = 0.;
        this.center = { u: 0, v: 0 };
        this.calculateRadius();

        // index in global triangulation's array of triangles
        this.id = -1;
    }

    toString()
    {
        return JSON.stringify({ v1: this.v1, v2: this.v2, v3: this.v3, radiusSq: this.radiusSq, center: this.center, id: this.id }, null, 2);
    }

    sort(_vertices)
    {
        // det > 0 => counter clock-wise
        let O = mat3.fromValues(1, 1, 1, _vertices[0].u, _vertices[1].u, _vertices[2].u, _vertices[0].v, _vertices[1].v, _vertices[2].v);
        return mat3.determinant(O) > 0 ? Array.from(_vertices) : Array.from([_vertices[0], _vertices[2], _vertices[1]]);
    }

    calculateRadius()
    {
        let a = mat3.determinant(mat3.fromValues(this.v1.u, this.v2.u, this.v3.u, this.v1.v, this.v2.v, this.v3.v, 1, 1, 1));
        let b = mat3.determinant(mat3.fromValues(this.v1.u ** 2 + this.v1.v ** 2, this.v2.u ** 2 + this.v2.v ** 2, this.v3.u ** 2 + this.v3.v ** 2, this.v1.v, this.v2.v, this.v3.v, 1, 1, 1));
        let c = mat3.determinant(mat3.fromValues(this.v1.u ** 2 + this.v1.v ** 2, this.v2.u ** 2 + this.v2.v ** 2, this.v3.u ** 2 + this.v3.v ** 2, this.v1.u, this.v2.u, this.v3.u, 1, 1, 1));

        if (Math.abs(a) < utils.EPS ** 2)
        {
            console.error(`${this}: Invalid delimiter for radiusSq`);
        }

        this.center.u = b / (2 * a);
        this.center.v = -c / (2 * a);
        this.radiusSq = (this.center.u - this.v1.u) ** 2 + (this.center.v - this.v1.v) ** 2;

        if (this.radiusSq === NaN)
        {
            console.error(`${this}: Invalid radiusSq in triangle`);
        }
    }

    getCentroid()
    {
        return {
            u: (this.v1.u + this.v2.u + this.v3.u) / 3,
            v: (this.v1.v + this.v2.v + this.v3.v) / 3
        }
    }

    getAdjEdge(_triangle)
    {
        if (!_triangle)
        {
            return null;
        }

        let edgeVertices = [];

        for (let i = 0; i < _triangle.vertices.length; ++i)
        {
            if (this.vertices.includes(_triangle.vertices[i]))
            {
                edgeVertices.push(_triangle.vertices[i]);
            }
        }

        if (edgeVertices.length === 2)
        {
            return new Edge(edgeVertices[0], edgeVertices[1]);
        }

        return null;
    }

    getAdjTriangle(_point)
    {
        let idx = this.indexOfPoint(_point);
        if (idx === -1)
        {
            console.error(`${this}: Point ${_point} doesn't belong to triangle.`);
            return null;
        }

        return this.adjTriangles[idx];
    }

    getAdjTriangles()
    {
        return this.adjTriangles;
    }

    // setup adj triangle opposite to point and vice versa
    setAdjTriangle(_point, _triangle)
    {
        let index = this.indexOfPoint(_point);
        if (index == -1)
        {
            console.error(`${this}: Cant setAdjTriangle ${_triangle} opposite to ${_point}. Point doesn't belong to this triangle.`);
            return;
        }

        this.adjTriangles[index] = _triangle;

        // TODO: OR do it manually ???
        // setup this as adj triangle for _triangle if not already set
        if (_triangle)
        {
            let adjEdge = _triangle.getAdjEdge(this);
            if (!adjEdge)
            {
                console.error(`${this}: Adjacement relations with ${_triangle} are violated.`);
                return;
            }

            let adjOppositePoint = _triangle.getOppositePoint(adjEdge);
            if (_triangle.getAdjTriangle(adjOppositePoint) != this)
            {
                _triangle.setAdjTriangle(adjOppositePoint, this);
            }
        }
    }

    getOppositePoint(_edge)
    {
        let idx1 = this.indexOfPoint(_edge.v1);
        let idx2 = this.indexOfPoint(_edge.v2);

        if (idx1 === -1 || idx2 === -1)
        {
            console.error(`${this}: Can't getOppositePoint to ${_edge}. Edge doesn't belong to triangle.`);
            return null;
        }

        // 0 + 1 + 2 = 3 -> idx3 = 3 - idx1 - idx2;
        return this.vertices[3 - idx1 - idx2];
    }

    getCrossPoints(_edge)
    {
        let crossPoints = [];
        let idx = this.indexOfPoint(_edge.v1);
        if (idx != -1)
        {
            crossPoints.push(this.vertices[idx]);
            for (let i = 1; i <= 2; ++i)
            {
                if (_edge.isInnerPoint(this.vertices[(idx + i) % 3]))
                {
                    crossPoints.push(this.vertices[(idx + i) % 3]);
                    return crossPoints;
                }
            }

            let crossPoint = _edge.getCrossPoint(new Edge(this.vertices[(idx + 1) % 3], this.vertices[(idx + 2) % 3]));
            if (crossPoint)
            {
                crossPoints.push(crossPoint);
                return crossPoints;
            }
        }
        else
        {
            let triangleEdge = new Edge();
            for (let i = 0; i < this.vertices.length; ++i)
            {
                triangleEdge.v1 = this.vertices[i];
                triangleEdge.v2 = this.vertices[(i + 1) % 3];

                let crossPoint = _edge.getCrossPoint(triangleEdge);
                if (crossPoint)
                {
                    crossPoints.push(crossPoint);
                }
            }
        }

        // crossPoints should be ordered in _edge direction
        if (crossPoints.length == 2)
        {
            let edgeDir = utils.vec2d(_edge.v1, _edge.v2);
            let crossDir = utils.vec2d(crossPoints[0], crossPoints[1]);

            const dot = utils.dot2d(edgeDir, crossDir);
            if (dot < 0)
            {
                crossPoints.reverse();
            }
        }

        return crossPoints;
    }

    isDelaunayCorrect(_point)
    {
        let rSq = (_point.u - this.center.u) ** 2 + (_point.v - this.center.v) ** 2;
        return this.radiusSq <= rSq; // this.radiusSq + 2 * utils.EPS <= rSq;
    }

    indexOfPoint(_point)
    {
        for (let i = 0; i < this.vertices.length; ++i)
        {
            if (_point == this.vertices[i] ||
                (Math.abs(_point.u - this.vertices[i].u) < utils.EPS && Math.abs(_point.v - this.vertices[i].v) < utils.EPS))
            {
                return i;
            }
        }

        return -1;
    }

    isVertexPoint(_point)
    {
        let idx = this.indexOfPoint(_point);
        if (idx != -1)
        {
            // TODO: BAD PLACE FOR THAT
            this.vertices[idx].bStructured = _point.bStructured;

            return true;
        }

        return false;
    }

    isEdgePoint(_point)
    {
        let edge = new Edge(this.v1, this.v2);
        if (edge.isInnerPoint(_point))
        {
            return edge;
        }

        edge.v1 = this.v2;
        edge.v2 = this.v3;
        if (edge.isInnerPoint(_point))
        {
            return edge;
        }

        edge.v1 = this.v3;
        edge.v2 = this.v1;
        if (edge.isInnerPoint(_point))
        {
            return edge;
        }

        return null;
    }

    isInnerPoint(_point)
    {
        // prev: Метод площадей (площадь треугольника == сумме площадей треугольников-частей)
        // let S = 1 / 2 * vec3.length(vec2.cross(vec3.create(), vec2.fromValues(this.v1.u - this.v2.u, this.v1.v - this.v2.v), vec2.fromValues(this.v1.u - this.v3.u, this.v1.v - this.v3.v))); // площадь этого треугольника
        // let S1 = 1 / 2 * vec3.length(vec2.cross(vec3.create(), vec2.fromValues(point.u - this.v2.u, point.v - this.v2.v), vec2.fromValues(point.u - this.v3.u, point.v - this.v3.v)));
        // let S2 = 1 / 2 * vec3.length(vec2.cross(vec3.create(), vec2.fromValues(point.u - this.v1.u, point.v - this.v1.v), vec2.fromValues(point.u - this.v3.u, point.v - this.v3.v)));
        // let S3 = 1 / 2 * vec3.length(vec2.cross(vec3.create(), vec2.fromValues(point.u - this.v2.u, point.v - this.v2.v), vec2.fromValues(point.u - this.v1.u, point.v - this.v1.v)));

        // return Math.abs(S - (S1 + S2 + S3)) < 1.e-7; // наличие точки на ребре или в вершине проверяем заранее

        // cur: Метод векторных произведений
        // TODO: use EPS ???
        // const cross2D = (a, b, p) => (p.u - a.u) * (b.v - a.v) - (p.v - a.v) * (b.u - a.u);

        let vec1 = utils.vec2d(_point, this.v1);
        let vec2 = utils.vec2d(_point, this.v2);
        let vec3 = utils.vec2d(_point, this.v3);

        let d1 = utils.cross2d(vec1, vec2);
        let d2 = utils.cross2d(vec2, vec3);
        let d3 = utils.cross2d(vec3, vec1);

        return (d1 >= 0 && d2 >= 0 && d3 >= 0) || (d1 <= 0 && d2 <= 0 && d3 <= 0);
    }

    // not included in triangle circumcircle (should handle it?)
    isOuterPoint(_point)
    {
        return this.radiusSq < (this.center.u - _point.u) ** 2 + (this.center.v - _point.v) ** 2 - utils.EPS / 2;
    }

    containsPoint(_point)
    {
        if (this.isOuterPoint(_point))
        {
            return false;
        }

        return this.isVertexPoint(_point) || this.isEdgePoint(_point) || this.isInnerPoint(_point);
    }

    hasEdge(_edge)
    {
        let idx1 = this.indexOfPoint(_edge.v1);
        let idx2 = this.indexOfPoint(_edge.v2);

        return idx1 != -1 && idx2 != -1;
    }
}