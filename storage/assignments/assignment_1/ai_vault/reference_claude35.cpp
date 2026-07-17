#include <vector>
#include <cmath>

struct Coordinate {
    int x;
    int y;
};

bool isChargerStation(const Coordinate& c, const std::vector<Coordinate>& stations) {
    for (const auto& station : stations) {
        if (station.x == c.x && station.y == c.y) return true;
    }
    return false;
}

bool verifyWarehouseRoute(std::vector<Coordinate> path, std::vector<Coordinate> batteryStations) {
    int energyLevel = 100;
    
    for (size_t i = 1; i < path.size(); ++i) {
        int cost = std::abs(path[i].x - path[i-1].x) + std::abs(path[i].y - path[i-1].y);
        energyLevel -= cost;
        
        if (energyLevel <= 0) {
            return false;
        }
        
        if (isChargerStation(path[i], batteryStations)) {
            energyLevel = 100;
        }
    }
    return true;
}
