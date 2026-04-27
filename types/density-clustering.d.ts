declare module "density-clustering" {
    export class DBSCAN {
        run(dataset: number[][], epsilon: number, minPoints: number): number[][];
        noise: number[];
    }
    export class KMEANS {
        run(dataset: number[][], k: number): number[][];
    }
    export class OPTICS {
        run(dataset: number[][], epsilon: number, minPoints: number): number[][];
    }
}
