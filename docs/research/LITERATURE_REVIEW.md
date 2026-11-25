# Tổng quan nội suy cho PAW

Tìm ngày 25/11/2026 theo tiêu đề công trình nền tảng ở Crossref, truy ngược danh mục của Li & Heap (2011), bổ sung soil moisture + wireless sensor networks, complex terrain, solar radiation và space-time. Đối chiếu DOI, tác giả, tên nguồn. Đọc toàn văn qua PLOS, MDPI và Climate Research. Với các tài liệu khác, ghi riêng abstract hoặc metadata. Loại nhận xét phản biện, phần mềm không liên quan và kết quả trùng. Đây là tìm kiếm có cấu trúc, phạm vi truy cập chưa bao phủ toàn bộ các cơ sở dữ liệu thương mại.

Các dòng metadata chỉ hỗ trợ truy vết thư mục. Các trường thiếu trong CSV ghi CXM (chưa xác minh); không đồng nghĩa tác giả không báo cáo. Công thức triển khai và giả định nằm ở METHOD_COMPARISON.md.

## Comparison of Four Spatial Interpolation Methods for Estimating Soil Moisture in a Complex Terrain Catchment

Xueling Yao, Bojie Fu, Yihe Lü, Feixiang Sun, Shuai Wang, Min Liu (2013). Toàn văn. 153 phẫu diện đến 1 m, đồi hoàng thổ Trung Quốc; nhiều loại đất sử dụng, phủ thực vật, vị trí sườn. IDW, OK, LR, RK; địa hình và lớp sử dụng đất. 6 lần chia ngẫu nhiên 102/51. Bảng 3 RMSE trung bình OK/IDW/LR/RK: 4.04/3.74/2.70/2.72 (10–20 cm); bảng 4: 5.10/4.84/4.20/4.11 (40–100 cm). RK lợi ở tầng sâu; LR có RMSE trung bình thấp hơn RK một chút ở tầng nông. Không chuyển sai số hoặc độ sâu sang đồi chè. Chia ngẫu nhiên chưa đo năng lực dự báo ngoài cụm. [DOI](https://doi.org/10.1371/journal.pone.0054660)

## An Extended Kriging Method to Interpolate Near-Surface Soil Moisture Data Measured by Wireless Sensor Networks

Jialin Zhang, Xiuhong Li, Rongjin Yang, Qiang Liu, Long Zhao, Baocheng Dou (2017). Toàn văn. 48 node WATERNET trên ruộng ngô khoảng 4.5 × 5 km, 36–45 node hữu dụng/ngày. Lấy mẫu mỗi 5 phút, tính trung bình ngày ở 10 cm. OK, Co-kriging, KED, Extended Kriging. NDVI, albedo và ảnh nguồn cho variogram. Leave-one-out, 10/07/2012: RMSE (%) Extended Kriging 2.4185, OK 2.6218, Co-kriging 3.0110, KED 3.1686. Lệch thang không gian giữa đầu dò và pixel 30 m, sai số lắp đặt độ sâu, bão hòa và hiệu chuẩn ảnh. Chỉ thử covariate đồng bộ khi thắng kiểm định theo vị trí. [DOI](https://doi.org/10.3390/s17061390)

## A two-dimensional interpolation function for irregularly-spaced data

Donald Shepard (1968). Metadata. Công trình phương pháp trên điểm bất quy tắc. Trọng số theo khoảng cách. Baseline PAW dùng w=d^-p chuẩn hóa. Metadata DOI; không trích sai số thực nghiệm. Kiểm tra khoảng cách theo mét, điểm trùng và giới hạn phạm vi; p=2 là điểm xuất phát. [DOI](https://doi.org/10.1145/800186.810616)

## Cross‐validation strategies for data with temporal, spatial, hierarchical, or phylogenetic structure

David R. Roberts, Volker Bahn, Simone Ciuti, Mark S. Boyce, Jane Elith, Gurutzeta Guillera‐Arroita, Severin Hauenstein, José J. Lahoz‐Monfort, Boris Schröder, Wilfried Thuiller, David I. Warton, Brendan A. Wintle, Florian Hartig, Carsten F. Dormann (2017). Abstract. Tổng quan, mô phỏng và ca thực tế có cấu trúc không gian, thời gian và phân cấp. Đối chiếu random CV và blocked CV. Chia ngẫu nhiên có thể đánh giá lỗi quá thấp; block quá rộng có thể biến nội suy thành ngoại suy. Giữ nguyên cụm vị trí trong fold. Đánh giá theo đợt tương lai riêng nếu mở rộng qua nhiều thời điểm. [DOI](https://doi.org/10.1111/ecog.02881)

## block CV : An r package for generating spatially or environmentally separated folds for k ‐fold cross‐validation of species distribution models

Roozbeh Valavi, Jane Elith, José J. Lahoz‐Monfort, Gurutzeta Guillera‐Arroita (2018). Abstract. Công cụ blockCV cho mô hình phân bố loài và biến địa lý. Chia fold theo khoảng cách hoặc điều kiện môi trường; khảo sát range tự tương quan của covariates. Tóm tắt mô tả công cụ thiết kế fold, không đưa RMSE đồi chè. Kiểm tra vùng phủ và số điểm từng block; bốn góc phần tư trong triển khai chỉ là thiết kế ban đầu. [DOI](https://doi.org/10.1111/2041-210x.13107)

## A Comparison of Three Kriging Methods Using Auxiliary Variables in Heavy‐Metal Contaminated Soils

Kai‐Wei Juang, Dar‐Yuan Lee (1998). Abstract. Khu đất nhiễm kim loại khoảng 10 ha tại Đào Viên. Cokriging, regression + kriging, kriging kết hợp Q-mode factor analysis. RK khai thác biến phụ tốt hơn trong trường hợp này; tóm tắt không cho số lỗi. So sánh drift thật với baseline trên vùng giữ lại. Mối liên hệ giữa các kim loại không chứng minh độ cao dự báo được ẩm đất. [DOI](https://doi.org/10.2134/jeq1998.00472425002700020016x)

## A Comparative Study of Interpolation Methods for Mapping Soil Properties

Alexandra Kravchenko, Donald G. Bullock (1999). Abstract. P và K đất trên 30 cánh đồng nông nghiệp, 60 bộ dữ liệu. InvD, OK, OK sau biến đổi log; thay đổi số láng giềng và số mũ. Kriging có tương quan cao hơn ở 57/60 bộ, MAE thấp hơn ở 44/60 và ME thấp hơn ở 31/60. Tối ưu tham số theo từng chỉ tiêu; tỷ lệ thắng của P/K không phải xác suất đúng cho độ ẩm. [DOI](https://doi.org/10.2134/agronj1999.00021962009100030007x)

## Further Comparison of Spatial Methods for Predicting Soil pH

G. M. Laslett, A. B. McBratney (1990). Abstract. Khảo sát pH được thiết kế để so sánh, có điểm gần nhau. Universal kriging với REML, smoothing splines, intrinsic random functions. Ngoại lệ làm thay đổi mạnh kết quả; UK REML tốt nhất trong bộ này, thêm trend nhìn thấy không cải thiện. Giữ cờ ngoại lệ và kiểm tra hiệu chuẩn trước khi loại. Cặp gần không thay cho phạm vi bao phủ. [DOI](https://doi.org/10.2136/sssaj1990.03615995005400060007x)

## Comparison of several spatial prediction methods for soil pH

G. M. LASLETT, A. B. McBRATNEY, P. J. PAHL, M. F. HUTCHINSON (1987). Abstract. Thiết kế khảo sát pH tầng mặt so sánh dự đoán hai chiều. IDW bình phương nghịch đảo, Akima, natural neighbour, trend bậc hai, smoothing spline và OK. Tổng bình phương sai số lớn hơn kỳ vọng; spline làm trơn và kriging thường tốt nhất trong nhóm không nội suy chính xác tại điểm. Phân biệt độ khớp ở cảm biến và sai số tại vị trí giữ lại; tham số nhiễu cần xét khi đo lặp. [DOI](https://doi.org/10.1111/j.1365-2389.1987.tb02148.x)

## Comparison of Methods for Interpolating Soil Properties Using Limited Data

C.A. Schloeder, N.E. Zimmerman, M.J. Jacobs (2001). Abstract. 46 điểm trên 1188 ha đồng bằng Vertisol, 12 tính chất đất. OK, IDW, thin-plate smoothing splines có tension. So sánh độ chính xác, hiệu quả bằng ANOVA và paired t-tests. Abstract mô tả OK và IDW tương đương. 9/12 tính chất không có mẫu phụ thuộc không gian trơn và đều. Ngay cả 46 điểm cũng không đảm bảo tạo bề mặt đáng tin. [DOI](https://doi.org/10.2136/sssaj2001.652470x)

## A comparison of kriging, cubic splines and classification for predicting soil properties from sample information

M. VOLTZ, R. WEBSTER (1990). Abstract. Hàm lượng sét tầng mặt ở Sandford St Martin và Yenne, địa mạo tương phản. Trung bình theo lớp, OK, spline bậc ba và kriging trong lớp. Hiệu năng thay đổi theo ranh giới; spline theo được chuyển tiếp đột ngột nhưng dao động quá mạnh ở phần khác. Mask lô và kiểm tra biên thổ nhưỡng. Lô hành chính không tự chứng minh đồng nhất đất. [DOI](https://doi.org/10.1111/j.1365-2389.1990.tb00080.x)

## Comparative analysis of interpolation methods in the middle Ebro Valley (Spain): application to annual precipitation and temperature

Sergio M. Vicente-Serrano, M. Ángel Saz-Sánchez, José M. Cuadrat (2003). 99 trạm mưa, 61 trạm nhiệt. Chuỗi nhiệt >15 năm. Tọa độ UTM 30N. IDW, spline, kriging, hồi quy theo biến địa lý/địa hình và các phương pháp kết hợp. Chia trạm ngẫu nhiên 70/30. Bảng 7, nhiệt độ trung bình năm: RMSE (°C) IDW p=2 0.56, OK 0.60, hồi quy 0.58. Bias tương ứng −0.32, −0.28, −0.06 °C. Lựa chọn thay đổi theo bias và RMSE. Kiểm tra DEM theo từng phiên đo PAW; trung bình năm khó đại diện cho 20 phút. [DOI](https://doi.org/10.3354/cr024161)

## Spatial interpolation methods applied in the environmental sciences: A review

Jin Li, Andrew D. Heap (2014). Abstract. Bài tổng quan phương pháp môi trường. So sánh 25 phương pháp. Xét thiết kế lấy mẫu, phân bố điểm, chất lượng và tương quan giữa biến chính/phụ. Không gán một RMSE chung cho các bộ dữ liệu. Dùng tiêu chí chất lượng và vùng phủ trước khi so sánh sai số CV. Hiệu quả theo biến và tập mẫu. [DOI](https://doi.org/10.1016/j.envsoft.2013.12.008)

## Within-field extrapolation away from a soil moisture probe using freely available satellite imagery and weather data

R. G. V. Bramley, E. M. Perry, J. Richetti, A. F. Colaço, D. J. Mowat, C. E. M. Ratcliff, R. A. Lawes (2024). Toàn văn. Hai vụ ở Nam và Tây Australia. Ba đầu dò ở SA, một ở WA. Tại SA, đối chiếu lấy mẫu 21 vị trí trong hai ngày thuộc hai năm. Hồi quy riêng theo tầng và vùng với NDVI tích lũy, mưa ròng tích lũy, growing degree days. R² hiệu chỉnh khoảng 0.4–0.7 cho dự báo nêu trong tóm tắt; không đồng nhất với R² khi fit tại đầu dò. Khác biệt theo độ sâu có thể lớn hơn khác biệt giữa vùng cùng ngày. PAW cần phân tầng đầu dò và kiểm định ngoại vùng. [DOI](https://doi.org/10.1007/s11119-024-10138-9)

## Soil moisture mapping using radio signal strength and gaussian process regression

Hongjun Yu, Erik Muller, Alex McBratney, Salah Sukkarieh (2026). Abstract. Mô phỏng nhiều mức dị thể và nhiễu; không có tập xác minh thực địa. GPR với RSS tích hợp dọc đường truyền RF, chọn điểm thích ứng theo độ bất định. Tóm tắt báo giảm sai số so với chọn ngẫu nhiên/GPR thường khi ít mẫu; số điểm và RMSE cụ thể CXM. PAW đo độ ẩm tại đầu dò. RSS LoRa không thể được chuyển thành độ ẩm hay dùng như quan sát điểm bằng các kết quả này. [DOI](https://doi.org/10.1007/s11119-026-10393-y)

## Spatialization Study of Monthly Global Solar Radiation in Sparse Observation Area Based on Environmental Similarity and Spatial Proximity

Mao-Fen Li, Peng-Tao Guo, A-Xing Zhu, Xuan Yu (2026). Abstract. Tổng bức xạ tháng, 11 trạm ở miền nhiệt đới Trung Quốc, năm 2015. ES-SP, OK và đa thức cục bộ. Random forest chọn biến địa hình và khí tượng theo tháng. LOOCV theo trạm, so sánh Wilcoxon. ES-SP đạt RMSE 37.23 MJ/m² trong tháng 12 và MAPE 4.34% trong tháng 8. Thang thời gian tháng và tổng năng lượng khác với bức xạ W/m² trung bình 20 phút của PAW. Cần đo bóng che và mây cùng đợt trước khi đánh giá drift. [DOI](https://doi.org/10.3390/atmos17020195)

## Phạm vi truy xuất

Đợt bổ sung ngày 26/11/2026 tìm theo các cụm *sparse soil moisture sensors*, *regression kriging wireless sensor network*, *field-scale GPR* và *solar radiation spatial interpolation complex terrain*. Đối chiếu trang tạp chí trên ScienceDirect, SpringerLink, IEEE Xplore, PLOS, MDPI và kho lưu trữ học thuật. Tìm kiếm giới hạn miền Google Scholar không cung cấp thêm bản đủ thông tin trích xuất. Đơn vị đếm là DOI duy nhất: 40 công trình, gồm 4 công trình đã đối chiếu toàn văn, 11 ở mức abstract và 25 ở mức metadata. 16 mục được phân tích riêng ở trên. Công trình chỉ có metadata được giữ để truy vết, không dùng cho so sánh sai số định lượng.
