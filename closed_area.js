import { Point, Data } from './2.js';
import { utils, Edge, Triangle } from './delaunay_utils.js';
import { glMatrix, vec2, vec3, vec4, quat, mat2, mat3, mat4 } from './libs/dist/esm/index.js';

// structured element (should not be changed during insertion in triangulation)
export class closedArea
{
    constructor(_points)
    {
        // for now it's consecutive points, that construct boundary (can by curve or closed area)
        this.points = [..._points];

        // TODO: for closed area only
        // lower left u/v and upper right u/v
        this.AABB = { lu: Number.MAX_VALUE, lv: Number.MAX_VALUE, ru: Number.MIN_VALUE, rv: Number.MIN_VALUE };
        this.calculateAABB();
    }

    calculateAABB()
    {
        for (let i = 0; i < this.points.length; ++i)
        {
            this.AABB.lu = Math.min(this.AABB.lu, this.points[i].u);
            this.AABB.lv = Math.min(this.AABB.lv, this.points[i].v);
            this.AABB.ru = Math.max(this.AABB.ru, this.points[i].u);
            this.AABB.rv = Math.max(this.AABB.rv, this.points[i].v);
        }

        if (this.AABB.lu === Number.MAX_VALUE || this.AABB.lv === Number.MAX_VALUE || this.AABB.ru === Number.MIN_VALUE || this.AABB.rv === Number.MIN_VALUE)
        {
            console.warn(`Invalid AABB for structured element of closed element: ${this.AABB}`);
        }
    }

    containsPoint(_point)
    {
        // robust compare with AABB for polygon
        if (!utils.between(_point.u, this.AABB.lu, this.AABB.ru) || !utils.between(_point.v, this.AABB.lv, this.AABB.rv))
        {
            return false;
        }

        if (_point.bStructured)
        {
            // polygon vertice handle
            return true;
        }

        // winding number algorithm
        let w = 0;
        for (let i = 0; i < this.points.length; ++i)
        {
            let p1 = this.points[i];
            let p2 = this.points[(i + 1) % this.points.length];

            // horizontal line crossed?
            if ((p1.v < _point.v && p2.v >= _point.v) || (p1.v >= _point.v && p2.v < _point.v))
            {
                // crossing to the right?
                let vec1 = utils.vec2d(_point, p1);
                let vec2 = utils.vec2d(_point, p2);

                let det = utils.cross2d(vec1, vec2);
                if ((det > 0 && p2.v > p1.v) || (det < 0 && p2.v < p1.v))
                {
                    w += (p2.v > p1.v) ? 1 : -1;
                }
            }
        }

        return w != 0;
    }

    containsTriangle(_triangle)
    {
        // should we check all vertices except centroid? (does crossing area available?)
        let centroid = _triangle.getCentroid();
        if (!this.containsPoint(centroid))
        {
            return false;
        }

        // do not allow triangle cross polygon edges
        // if all points inside polygon => triangle is inside
        for (let i = 0; i < _triangle.vertices.length; ++i)
        {
            if (!this.containsPoint(_triangle.vertices[i]))
            {
                return false;
            }
        }

        return true;
    }
}