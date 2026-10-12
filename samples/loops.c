int grid_total(void) {
    int total = 0;
    for (int row = 0; row < 4; row++) {
        for (int column = 0; column < 3; column++) {
            if (column == 1) {
                continue;
            }
            total += row + column;
        }
    }
    return total;
}
