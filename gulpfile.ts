import gulp from "gulp";
import ts from "gulp-typescript";
import gulpCopy from "gulp-copy";

// https://www.typescriptlang.org/docs/handbook/gulp.html
const tsProject = ts.createProject("tsconfig.json");

gulp.task('build', function () {
    const destination = "release/";

    tsProject.src().pipe(tsProject());

    const filesToCopy = ["package.json", "README.md", "source/**/*.d.ts", "source/**/*.js"];

    return gulp.src(filesToCopy)
    .pipe(gulpCopy(destination));
});