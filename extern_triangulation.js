
let ExternDelTrig = {
    ///////////////////////////////////// ЕЩЕ ОДНА ТРИАНГУЛЯЦИЯ

    // вычисление центра и радиуса описанной окружности вокруг треугольника
    circumcircle_of_triangle: function (points, ind_v1, ind_v2, ind_v3)
    {
        // let a = mat3.fromValues(points[ind_v1].u, points[ind_v2].u, points[ind_v3].u, points[ind_v1].v, points[ind_v2].v, points[ind_v3].v, 1, 1, 1);
        // let b = mat3.fromValues(points[ind_v1].u**2 + points[ind_v1].v**2, points[ind_v2].u**2 + points[ind_v2].v**2, points[ind_v3].u**2 + points[ind_v3].v**2, points[ind_v1].v, points[ind_v2].v, points[ind_v3].v, 1, 1, 1);
        // let c = mat3.fromValues(points[ind_v1].u**2 + points[ind_v1].v**2, points[ind_v2].u**2 + points[ind_v2].v**2, points[ind_v3].u**2 + points[ind_v3].v**2, points[ind_v1].u, points[ind_v2].u, points[ind_v3].u, 1, 1, 1);
        // let d = mat3.fromValues(points[ind_v1].u**2 + points[ind_v1].v**2, points[ind_v2].u**2 + points[ind_v2].v**2, points[ind_v3].u**2 + points[ind_v3].v**2, points[ind_v1].u, points[ind_v2].u, points[ind_v3].u, points[ind_v1].v, points[ind_v2].v, points[ind_v3].v);

        // let fx = vec3.fromValues(-(points[ind_v1].u**2 + points[ind_v1].v**2), -(points[ind_v2].u**2 + points[ind_v2].v**2), -(points[ind_v3].u**2 + points[ind_v3].v**2));
        // let matr = mat3.fromValues(2*points[ind_v1].u, 2*points[ind_v2].u, 2*points[ind_v3].u, 2*points[ind_v1].v, 2*points[ind_v2].v, 2*points[ind_v3].v, 1, 1, 1);

        // let answer = vec3.transformMat3(vec3.create(), fx, mat3.invert(matr, matr));

        // let uc = - answer[0];
        // let vc = - answer[1];

        // let rad = Math.sqrt(uc**2 + vc**2 - answer[2]);

        // // let radius = (mat3.determinant(b)**2 + mat3.determinant(c)**2 - 4 * mat3.determinant(a) * mat3.determinant(d)) / (4 * mat3.determinant(a)**2);
        // return {'a': ind_v1, 'b': ind_v2, 'c': ind_v3, 'u': uc, 'v': vc, 'r': rad**2};

        let EPS = 1e-7;
        let u1 = points[ind_v1].u, y1 = points[ind_v1].v;
        let u2 = points[ind_v2].u, y2 = points[ind_v2].v;
        let u3 = points[ind_v3].u, y3 = points[ind_v3].v;
        let dy12 = Math.abs(y1 - y2), dy23 = Math.abs(y2 - y3);
        let xc, yc;
        if (dy12 < EPS)
        {
            let m2 = -((u3 - u2) / (y3 - y2));
            let mx2 = (u2 + u3) / 2, my2 = (y2 + y3) / 2;
            xc = (u1 + u2) / 2, yc = m2 * (xc - mx2) + my2;
        }
        else if (dy23 < EPS)
        {
            let m1 = -((u2 - u1) / (y2 - y1));
            let mx1 = (u1 + u2) / 2, my1 = (y1 + y2) / 2;
            xc = (u2 + u3) / 2, yc = m1 * (xc - mx1) + my1;
        }
        else
        {
            let m1 = -((u2 - u1) / (y2 - y1)), m2 = -((u3 - u2) / (y3 - y2));
            let mx1 = (u1 + u2) / 2, my1 = (y1 + y2) / 2;
            let mx2 = (u2 + u3) / 2, my2 = (y2 + y3) / 2;
            xc = (m1 * mx1 - m2 * mx2 + my2 - my1) / (m1 - m2);
            if (dy12 > dy23) yc = m1 * (xc - mx1) + my1;
            else yc = m2 * (xc - mx2) + my2;
        }
        let dx = u2 - xc, dy = y2 - yc;
        return { 'a': ind_v1, 'b': ind_v2, 'c': ind_v3, 'u': xc, 'v': yc, 'r': dx ** 2 + dy ** 2 };
    },

    // функция, удаляющая кратные ребра
    delete_multiples_edges: function (edges)
    {
        for (let j = edges.length - 1; j >= 0;)
        {
            let b = edges[j]; j--;
            let a = edges[j]; j--;
            let n, m;
            for (let i = j; i >= 0;)
            {
                n = edges[i]; i--;
                m = edges[i]; i--;
                if (a === m && b === n)
                {
                    edges.splice(j + 1, 2);
                    edges.splice(i + 1, 2);
                    break;
                }
                if (a === n && b === m)
                {
                    edges.splice(j + 1, 2);
                    edges.splice(i + 1, 2);
                    break;
                }
            }
        }
    },

    // функция, находящая треугольник, содержащий все точки множества
    big_triangle: function (points)
    {
        let minx = 0;
        let miny = 0;
        let maxx = 1;
        let maxy = 1;

        let dx = 1, dy = 1;
        let dxy = Math.max(dx, dy);
        let midx = dx * 0.5 + minx, midy = dy * 0.5 + miny;
        let tr = [new Point(0, 0, 0), new Point(0, 0, 0), new Point(0, 0, 0)];
        tr[0].setParams(midx - 10 * dxy, midy - 10 * dxy);
        tr[1].setParams(midx, midy + 10 * dxy);
        tr[2].setParams(midx + 10 * dxy, midy - 10 * dxy);
        return tr;
    },

    // функция, находящая триангуляцию
    triangulate: function (points1)
    {
        let EPS = 1.e-7;
        let n = points1.length;
        if (n < 3) return []; // треугольников нет

        let points = [...points1]; // копия массива

        // массив индексов, отсортированных по координате u
        let ind = [];
        for (let i = 0; i < n; i++) ind.push(i);
        ind.sort(function (l, r) { return points[r].u - points[l].u; })

        // находим треугольник, содержащий все точки, и вставлем его в конец массива с вершинами
        let big = this.big_triangle(points);
        points.push(big[0]);
        points.push(big[1]);
        points.push(big[2]);

        let cur_points = [this.circumcircle_of_triangle(points, n, n + 1, n + 2)];
        let ans = [];
        let edges = [];

        // перебираем все точки
        for (let i = ind.length - 1; i >= 0; i--)
        {
            // перебираем все треугольники
            // если точка находится внутри треугольника, то нужно его удалить
            for (let j = cur_points.length - 1; j >= 0; j--)
            {
                // если точка справа от описанной окружности, то треугольник проверять больше не нужно
                // точки отсортированы и поэтому тоже будут справа
                let dx = points[ind[i]].u - cur_points[j].u;
                if (dx > 0 && dx * dx > cur_points[j].r)
                {
                    ans.push(cur_points[j]);
                    cur_points.splice(j, 1);
                    continue;
                }

                // если точка вне окружности, то треугольник изменять не нужно
                let dy = points[ind[i]].v - cur_points[j].v;
                if (dx * dx + dy * dy - cur_points[j].r > EPS)
                {
                    continue;
                }

                // удаляем треугольник и добавляем его стороны в список ребер
                edges.push(
                    cur_points[j].a, cur_points[j].b,
                    cur_points[j].b, cur_points[j].c,
                    cur_points[j].c, cur_points[j].a
                );
                cur_points.splice(j, 1);
            }

            // удаляем кратные ребра
            this.delete_multiples_edges(edges);

            // создаем новые треугольники последовательно по списку ребер
            for (let j = edges.length - 1; j >= 0;)
            {
                let b = edges[j]; j--;
                if (j < 0) break;
                let a = edges[j]; j--;
                cur_points.push(this.circumcircle_of_triangle(points, a, b, ind[i]));
            }
            edges = [];

        }

        // формируем массив с триангуляцией
        for (let i = cur_points.length - 1; i >= 0; i--)
        {
            ans.push(cur_points[i]);
        }

        let tr = []
        for (let i = 0; i < ans.length; i++)
        {
            if (ans[i].a < n && ans[i].b < n && ans[i].c < n)
            {
                tr.push(ans[i].a, ans[i].b, ans[i].c);
            }
        }
        console.log(tr);
        return tr;
    }
}
