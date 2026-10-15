import React, { useState, useMemo } from 'react';
import { AppData, Product, Order, AppUser, AppSettings } from '../../types';
import {
  generateInventoryReport,
  generateProfitReport,
  generateFifoCostDetailsReport,
  FifoCostDetailRow
} from '../../services/fifo';
import { formatCurrency, formatDate, formatNumber, formatPrecise } from '../../utils/formatters';
import { OrderFormModal } from '../Sales/OrderFormModal';
import * as XLSX from 'xlsx';
import {
  BarChart3,
  Calendar,
  Layers,
  TrendingUp,
  Download,
  Filter,
  DollarSign,
  Receipt,
  FileSpreadsheet,
  Boxes,
  PackageCheck,
  Search,
  BookOpen,
  Edit,
  Edit3,
  Users
} from 'lucide-react';
import { CustomerSalesReport } from './CustomerSalesReport';

interface ReportsManagerProps {
  data: AppData;
  currentUser?: AppUser | null;
  settings?: AppSettings;
  onSaveOrder?: (order: Order) => void;
}

export const ReportsManager: React.FC<ReportsManagerProps> = ({
  data,
  currentUser,
  settings,
  onSaveOrder,
}) => {
  const [activeReport, setActiveReport] = useState<
    'inventory' | 'profit' | 'costDetails' | 'customerSales'
  >('inventory');

  // Edit Order modal state from Xuat Nhap Kho report
  const [editingOrder, setEditingOrder] = useState<Order | null>(null);
  const [isOrderModalOpen, setIsOrderModalOpen] = useState(false);

  const handleOpenEditOrder = (code: string) => {
    const ord = data.orders.find((o) => o.orderCode === code);
    if (ord) {
      setEditingOrder(ord);
      setIsOrderModalOpen(true);
    } else {
      alert(`Không tìm thấy dữ liệu chi tiết của đơn hàng ${code}.`);
    }
  };

  // Dates
  const [startDate, setStartDate] = useState<string>(
    new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10)
  );
  const [endDate, setEndDate] = useState<string>(
    new Date().toISOString().slice(0, 10)
  );

  // Profit filters
  const [profitOrderFilter, setProfitOrderFilter] = useState<string>('all');
  const [profitProductFilter, setProfitProductFilter] = useState<string>('all');
  const [profitSalespersonFilter, setProfitSalespersonFilter] = useState<string>('all');

  // Cost Details filters
  const [costOrderFilter, setCostOrderFilter] = useState<string>('all');
  const [costProductFilter, setCostProductFilter] = useState<string>('all');
  const [costSalespersonFilter, setCostSalespersonFilter] = useState<string>('all');
  const [costSearchQuery, setCostSearchQuery] = useState<string>('');

  // Extract list of unique salespeople / creators
  const salespeople = useMemo(() => {
    const set = new Set<string>();
    data.orders.forEach((o) => {
      if (o.createdByName && o.createdByName.trim()) {
        set.add(o.createdByName.trim());
      }
    });
    (data.users || []).forEach((u) => {
      if (u.fullName && u.fullName.trim()) {
        set.add(u.fullName.trim());
      }
    });
    return Array.from(set).sort();
  }, [data.orders, data.users]);

  // Generate Inventory Report with dynamic order columns
  const inventoryReport = useMemo(() => {
    return generateInventoryReport(startDate, endDate, data);
  }, [startDate, endDate, data]);

  // Inventory Totals
  const inventoryTotals = useMemo(() => {
    return inventoryReport.rows.reduce(
      (acc, r) => ({
        beginning: acc.beginning + r.beginningQty,
        importPeriod: acc.importPeriod + r.periodImportQty,
        exportPeriod: acc.exportPeriod + r.periodExportQty,
        ending: acc.ending + r.endingQty,
      }),
      { beginning: 0, importPeriod: 0, exportPeriod: 0, ending: 0 }
    );
  }, [inventoryReport]);

  // Generate FIFO Profit Report
  const profitReport = useMemo(() => {
    const raw = generateProfitReport(startDate, endDate, data);

    const filteredItems = raw.items.filter((item) => {
      const matchOrder = profitOrderFilter === 'all' || item.orderCode === profitOrderFilter;
      const matchProduct = profitProductFilter === 'all' || item.productCode === profitProductFilter;
      const matchSalesperson =
        profitSalespersonFilter === 'all' || item.createdByName === profitSalespersonFilter;
      return matchOrder && matchProduct && matchSalesperson;
    });

    const totalRevenue = filteredItems.reduce((acc, i) => acc + i.revenue, 0);
    const totalCost = filteredItems.reduce((acc, i) => acc + i.totalCostFifo, 0);
    const totalProfit = totalRevenue - totalCost;
    const avgMargin = totalRevenue > 0 ? (totalProfit / totalRevenue) * 100 : 0;
    const totalQtySale = filteredItems.reduce((acc, i) => acc + i.quantity, 0);
    const totalQtyPurchase = filteredItems.reduce((acc, i) => acc + i.quantityInPurchaseUnit, 0);

    return {
      items: filteredItems,
      totalRevenue,
      totalCost,
      totalProfit,
      avgMargin,
      totalQtySale,
      totalQtyPurchase,
    };
  }, [startDate, endDate, data, profitOrderFilter, profitProductFilter, profitSalespersonFilter]);

  // Generate FIFO Cost Details Report (Báo cáo chi tiết giá vốn theo từng đơn hàng, mặt hàng, đơn giá xuất kho FIFO)
  const costDetailsReport = useMemo(() => {
    const raw = generateFifoCostDetailsReport(startDate, endDate, data);

    const filteredRows = raw.rows.filter((r) => {
      const matchOrder = costOrderFilter === 'all' || r.orderCode === costOrderFilter;
      const matchProduct = costProductFilter === 'all' || r.productCode === costProductFilter;
      const matchSalesperson =
        costSalespersonFilter === 'all' || r.createdByName === costSalespersonFilter;
      const matchQuery = !costSearchQuery ||
        r.orderCode.toLowerCase().includes(costSearchQuery.toLowerCase()) ||
        r.customerName.toLowerCase().includes(costSearchQuery.toLowerCase()) ||
        (r.createdByName && r.createdByName.toLowerCase().includes(costSearchQuery.toLowerCase())) ||
        r.productCode.toLowerCase().includes(costSearchQuery.toLowerCase()) ||
        r.productName.toLowerCase().includes(costSearchQuery.toLowerCase()) ||
        r.lotBillNo.toLowerCase().includes(costSearchQuery.toLowerCase());
      return matchOrder && matchProduct && matchSalesperson && matchQuery;
    });

    const totalExportQtySaleUnit = filteredRows.reduce((acc, r) => acc + r.lotExportQty, 0);
    const totalExportQtyPurchaseUnit = filteredRows.reduce((acc, r) => acc + r.lotExportQtyPurchaseUnit, 0);
    const totalCostAmount = filteredRows.reduce((acc, r) => acc + r.lotTotalCost, 0);

    return {
      rows: filteredRows,
      totalExportQtySaleUnit,
      totalExportQtyPurchaseUnit,
      totalCostAmount,
    };
  }, [startDate, endDate, data, costOrderFilter, costProductFilter, costSalespersonFilter, costSearchQuery]);

  // Export Inventory Report to Excel
  const handleExportInventoryReport = () => {
    const { rows, orderCodes } = inventoryReport;

    const excelData = rows.map((r, idx) => {
      const rowObj: Record<string, any> = {
        'STT': idx + 1,
        'Mã HH': r.productCode,
        'Tên hàng hóa': r.productName,
        'ĐVT_Bán': r.saleUnit,
        'SL Tồn đầu kỳ': r.beginningQty,
        'SL Nhập trong kỳ': r.periodImportQty,
        'SL Tồn cuối kỳ': r.endingQty,
        'Tổng SL xuất': r.periodExportQty,
      };

      // Individual order columns
      orderCodes.forEach((code) => {
        rowObj[`Đơn ${code}`] = r.orderExports[code] || 0;
      });

      return rowObj;
    });

    const ws = XLSX.utils.json_to_sheet(excelData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'BaoCaoXuatNhapKho');
    XLSX.writeFile(wb, `Bao_Cao_Xuat_Nhap_Kho_${startDate}_den_${endDate}.xlsx`);
  };

  // Export Profit Report to Excel
  const handleExportProfitReport = () => {
    const excelData = profitReport.items.map((i, idx) => {
      const isFirstOfOrder = idx === 0 || i.orderCode !== profitReport.items[idx - 1]?.orderCode;
      return {
        'STT': idx + 1,
        'Mã đơn': isFirstOfOrder ? i.orderCode : '',
        'Ngày đơn': isFirstOfOrder ? i.orderDate : '',
        'Khách hàng': isFirstOfOrder ? i.customerName : '',
        'Người tạo đơn/Bán hàng': isFirstOfOrder ? (i.createdByName || '') : '',
        'Mã HH': i.productCode,
        'Tên hàng hóa': i.productName,
        'ĐVT_Bán': i.saleUnit,
        'SL bán (Theo ĐVT_Bán)': i.quantity,
        'SL quy đổi': i.conversionRate,
        'ĐVT_Mua': i.purchaseUnit,
        'SL xuất (Theo ĐVT_Mua)': Number(i.quantityInPurchaseUnit.toFixed(4)),
        'Đơn giá bán trước thuế': i.salePrice,
        'Doanh thu thuần': i.revenue,
        'Giá vốn/ĐVT_Mua (FIFO)': Number(i.unitCostFifoPurchaseUnit.toFixed(4)),
        'Giá vốn hàng bán (Theo phương pháp FIFO tính theo ĐVT_Mua)': i.totalCostFifo,
        'Lợi nhuận gộp': i.grossProfit,
        'Tỷ suất LN (%)': Number(i.marginPercent.toFixed(2)),
      };
    });

    const ws = XLSX.utils.json_to_sheet(excelData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'BaoCaoLoiNhuanFIFO');
    XLSX.writeFile(wb, `Bao_Cao_Loi_Nhuan_FIFO_${startDate}_den_${endDate}.xlsx`);
  };

  // Export FIFO Cost Details Report to Excel
  const handleExportCostDetailsReport = () => {
    const excelData = costDetailsReport.rows.map((r, idx) => {
      const isFirstOfOrder = idx === 0 || r.orderCode !== costDetailsReport.rows[idx - 1]?.orderCode;
      return {
        'STT': idx + 1,
        'Mã đơn hàng': isFirstOfOrder ? r.orderCode : '',
        'Ngày đơn': isFirstOfOrder ? r.orderDate : '',
        'Khách hàng': isFirstOfOrder ? r.customerName : '',
        'Người tạo đơn/Bán hàng': isFirstOfOrder ? (r.createdByName || '') : '',
        'Mã HH': r.productCode,
        'Tên hàng hóa': r.productName,
        'ĐVT_Bán': r.saleUnit,
        'SL xuất (ĐVT_Bán)': r.lotExportQty,
        'SL quy đổi': r.conversionRate,
        'ĐVT_Mua': r.purchaseUnit,
        'SL xuất (ĐVT_Mua)': Number(r.lotExportQtyPurchaseUnit.toFixed(4)),
        'Lô nhập nguồn (Bill No)': r.lotBillNo,
        'Ngày nhập nguồn': r.lotPurchaseDate,
        'Đơn giá xuất kho (Theo ĐVT_Bán)': r.lotUnitCost,
        'Đơn giá xuất kho (Theo ĐVT_Mua)': Number(r.lotUnitCostPurchaseUnit.toFixed(4)),
        'Giá vốn hàng bán (FIFO)': r.lotTotalCost,
      };
    });

    const ws = XLSX.utils.json_to_sheet(excelData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'ChiTietGiaVonFIFO');
    XLSX.writeFile(wb, `Bao_Cao_Chi_Tiet_Gia_Von_FIFO_${startDate}_den_${endDate}.xlsx`);
  };

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-4 sm:p-5 rounded-2xl border border-slate-200 shadow-xs">
        <div>
          <div className="flex items-center gap-2">
            <BarChart3 className="w-6 h-6 text-indigo-600" />
            <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
              Báo cáo Quản trị & Phân tích Kinh doanh
            </h1>
          </div>
          <p className="text-xs sm:text-sm text-slate-500 mt-1">
            Báo cáo Xuất nhập kho, Báo cáo Lợi nhuận gộp & Chi tiết giá vốn (FIFO), Báo cáo Số lượng hàng bán cho từng khách hàng
          </p>
        </div>

        {/* Date Filter */}
        <div className="flex flex-wrap items-center gap-2 bg-slate-50 p-2.5 rounded-xl border border-slate-200">
          <Calendar className="w-4 h-4 text-slate-500" />
          <span className="text-xs font-semibold text-slate-600">Từ:</span>
          <input
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            className="px-2.5 py-1 text-xs border border-slate-300 rounded-lg bg-white font-medium"
          />
          <span className="text-xs font-semibold text-slate-600">Đến:</span>
          <input
            type="date"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            className="px-2.5 py-1 text-xs border border-slate-300 rounded-lg bg-white font-medium"
          />
        </div>
      </div>

      {/* Tabs */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between border-b border-slate-200 gap-3">
        <div className="flex items-center gap-2 overflow-x-auto">
          <button
            type="button"
            onClick={() => setActiveReport('inventory')}
            className={`flex items-center gap-2 px-4 py-3 text-sm font-bold border-b-2 whitespace-nowrap transition-all cursor-pointer ${
              activeReport === 'inventory'
                ? 'border-indigo-600 text-indigo-700 bg-indigo-50/50'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <Layers className="w-4 h-4" />
            <span>Báo cáo Xuất nhập kho</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveReport('profit')}
            className={`flex items-center gap-2 px-4 py-3 text-sm font-bold border-b-2 whitespace-nowrap transition-all cursor-pointer ${
              activeReport === 'profit'
                ? 'border-indigo-600 text-indigo-700 bg-indigo-50/50'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <TrendingUp className="w-4 h-4" />
            <span>Báo cáo Lợi nhuận (FIFO)</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveReport('costDetails')}
            className={`flex items-center gap-2 px-4 py-3 text-sm font-bold border-b-2 whitespace-nowrap transition-all cursor-pointer ${
              activeReport === 'costDetails'
                ? 'border-indigo-600 text-indigo-700 bg-indigo-50/50'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <BookOpen className="w-4 h-4" />
            <span>Báo cáo Chi tiết Giá vốn (FIFO)</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveReport('customerSales')}
            className={`flex items-center gap-2 px-4 py-3 text-sm font-bold border-b-2 whitespace-nowrap transition-all cursor-pointer ${
              activeReport === 'customerSales'
                ? 'border-indigo-600 text-indigo-700 bg-indigo-50/50'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <Users className="w-4 h-4" />
            <span>Báo cáo SL bán theo khách hàng</span>
          </button>
        </div>

        {activeReport !== 'customerSales' && (
          <button
            type="button"
            onClick={
              activeReport === 'inventory'
                ? handleExportInventoryReport
                : activeReport === 'profit'
                ? handleExportProfitReport
                : handleExportCostDetailsReport
            }
            className="inline-flex items-center justify-center gap-1.5 px-4 py-2 text-xs font-semibold rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs cursor-pointer self-start lg:self-auto mb-2 lg:mb-0"
          >
            <Download className="w-3.5 h-3.5" />
            <span>
              {activeReport === 'inventory'
                ? 'Xuất Excel Xuất nhập kho'
                : activeReport === 'profit'
                ? 'Xuất Excel Lợi nhuận'
                : 'Xuất Excel Chi tiết giá vốn'}
            </span>
          </button>
        )}
      </div>

      {/* 1. BÁO CÁO XUẤT NHẬP KHO */}
      {activeReport === 'inventory' && (
        <div className="space-y-4">
          <div className="p-3.5 bg-indigo-50/60 rounded-xl border border-indigo-200 text-xs text-indigo-900 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div>
              <span className="font-bold">Đặc tả báo cáo:</span> Báo cáo thể hiện tồn đầu kỳ, <span className="font-bold text-indigo-900 bg-indigo-100 px-1.5 py-0.5 rounded">SL nhập trong kỳ</span>, tồn cuối kỳ, tổng xuất và từng cột đơn hàng xuất riêng lẻ từ {formatDate(startDate)} đến {formatDate(endDate)}.
            </div>
            <span className="font-bold text-indigo-800 whitespace-nowrap">
              Tổng số mặt hàng: {inventoryReport.rows.length} • Tổng số đơn xuất: {inventoryReport.orderCodes.length}
            </span>
          </div>

          <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
            <div className="overflow-x-auto max-h-[72vh] overflow-y-auto">
              <table className="w-full text-xs text-left border-collapse min-w-[1000px]">
                <thead className="sticky top-0 z-20 bg-slate-100 text-slate-700 uppercase font-bold text-[11px] tracking-wider shadow-xs">
                  <tr>
                    {/* Fixed Left Columns */}
                    <th className="p-3 w-10 text-left border-r border-slate-200 sticky left-0 bg-slate-100 z-30">
                      STT
                    </th>
                    <th className="p-3 text-left font-mono sticky left-10 bg-slate-100 z-30 border-r border-slate-200">
                      Mã HH
                    </th>
                    <th className="p-3 text-left min-w-44 sticky left-32 bg-slate-100 z-30 border-r border-slate-200">
                      Tên HH
                    </th>
                    <th className="p-3 text-left border-r border-slate-200 bg-slate-100">
                      ĐVT_Bán
                    </th>
                    <th className="p-3 text-right bg-blue-50/70 border-r border-slate-200 text-blue-900">
                      SL Tồn đầu kỳ
                    </th>
                    <th className="p-3 text-right bg-indigo-50 border-r border-slate-200 text-indigo-950 font-black">
                      SL Nhập trong kỳ
                    </th>
                    <th className="p-3 text-right bg-emerald-50/80 border-r border-slate-200 text-emerald-950 font-black min-w-28">
                      SL Tồn cuối kỳ
                    </th>
                    <th className="p-3 text-right bg-amber-50/70 border-r border-slate-200 text-amber-900 font-black">
                      Tổng SL xuất
                    </th>

                    {/* Individual Sales Order Columns with Pencil Edit Button */}
                    {inventoryReport.orderCodes.map((code) => (
                      <th
                        key={code}
                        className="p-3 text-center bg-indigo-50/80 border-r border-slate-200 text-indigo-950 font-mono whitespace-nowrap min-w-32"
                      >
                        <div className="flex items-center justify-center gap-1.5">
                          <span className="font-bold">{code}</span>
                          <button
                            type="button"
                            onClick={() => handleOpenEditOrder(code)}
                            className="p-1 rounded text-indigo-600 hover:text-white hover:bg-indigo-600 transition-colors cursor-pointer shadow-2xs"
                            title={`Sửa đơn hàng ${code} từ báo cáo`}
                          >
                            <Edit className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {inventoryReport.rows.length === 0 ? (
                    <tr>
                      <td
                        colSpan={8 + inventoryReport.orderCodes.length}
                        className="p-12 text-center text-slate-400"
                      >
                        Chưa có dữ liệu hàng hóa.
                      </td>
                    </tr>
                  ) : (
                    inventoryReport.rows.map((row, idx) => (
                      <tr key={row.productCode} className="hover:bg-slate-50/80">
                        <td className="p-3 text-center text-slate-400 border-r border-slate-100 sticky left-0 bg-white z-10">
                          {idx + 1}
                        </td>
                        <td className={`p-3 font-mono font-bold sticky left-10 bg-white border-r border-slate-100 z-10 ${
                          row.endingQty < 0 ? 'text-red-600' : 'text-indigo-700'
                        }`}>
                          {row.productCode}
                        </td>
                        <td className={`p-3 font-semibold sticky left-32 bg-white border-r border-slate-100 z-10 ${
                          row.endingQty < 0 ? 'text-red-600' : 'text-slate-900'
                        }`}>
                          {row.productName}
                        </td>
                        <td className="p-3 text-center text-slate-600 border-r border-slate-100">
                          {row.saleUnit}
                        </td>
                        <td className="p-3 text-right bg-blue-50/30 font-medium text-blue-800 border-r border-slate-100">
                          {formatNumber(row.beginningQty)}
                        </td>
                        <td className="p-3 text-right bg-indigo-50/40 font-bold text-indigo-800 border-r border-slate-100">
                          {formatNumber(row.periodImportQty)}
                        </td>
                        <td className={`p-3 text-right border-r border-slate-100 font-black ${
                          row.endingQty < 0
                            ? 'text-red-600 bg-red-50/80 border border-red-200'
                            : 'text-emerald-800 bg-emerald-50/40'
                        }`}>
                          {formatNumber(row.endingQty)}
                        </td>
                        <td className="p-3 text-right bg-amber-50/30 font-bold text-amber-800 border-r border-slate-100">
                          {formatNumber(row.periodExportQty)}
                        </td>

                        {/* Order Exports per Product */}
                        {inventoryReport.orderCodes.map((code) => {
                          const exportedQty = row.orderExports[code] || 0;
                          return (
                            <td
                              key={code}
                              className="p-3 text-right border-r border-slate-100 font-mono text-slate-800"
                            >
                              {exportedQty > 0 ? (
                                <span className="font-semibold text-indigo-900">
                                  {formatNumber(exportedQty)}
                                </span>
                              ) : (
                                <span className="text-slate-300">—</span>
                              )}
                            </td>
                          );
                        })}
                      </tr>
                    ))
                  )}
                </tbody>
                {inventoryReport.rows.length > 0 && (
                  <tfoot className="sticky bottom-0 bg-slate-100 font-bold text-[11px] shadow-sm z-10">
                    <tr className="border-t-2 border-slate-300">
                      <td
                        colSpan={4}
                        className="p-3 text-center uppercase tracking-wider text-slate-700 border-r border-slate-300 sticky left-0 bg-slate-100 z-20"
                      >
                        Tổng cộng
                      </td>
                      <td className="p-3 text-right bg-blue-100/70 border-r border-slate-300 text-blue-900">
                        {formatNumber(inventoryTotals.beginning)}
                      </td>
                      <td className="p-3 text-right bg-indigo-100 border-r border-slate-300 text-indigo-950 font-black">
                        {formatNumber(inventoryTotals.importPeriod)}
                      </td>
                      <td className="p-3 text-right bg-emerald-100 border-r border-slate-300 text-emerald-950 font-black">
                        {formatNumber(inventoryTotals.ending)}
                      </td>
                      <td className="p-3 text-right bg-amber-100 border-r border-slate-300 text-amber-950 font-black">
                        {formatNumber(inventoryTotals.exportPeriod)}
                      </td>

                      {/* Total Exports per Order Column */}
                      {inventoryReport.orderCodes.map((code) => {
                        const totalForOrder = inventoryReport.rows.reduce(
                          (acc, r) => acc + (r.orderExports[code] || 0),
                          0
                        );
                        return (
                          <td
                            key={code}
                            className="p-3 text-right bg-indigo-100/60 border-r border-slate-300 text-indigo-950 font-mono font-bold"
                          >
                            {totalForOrder > 0 ? formatNumber(totalForOrder) : '—'}
                          </td>
                        );
                      })}
                    </tr>
                  </tfoot>
                )}
              </table>
            </div>
          </div>
        </div>
      )}

      {/* 2. BÁO CÁO LỢI NHUẬN (FIFO) */}
      {activeReport === 'profit' && (
        <div className="space-y-4">
          {/* Summary KPIs */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
              <span className="text-xs text-slate-500 font-medium uppercase">Doanh thu thuần</span>
              <div className="text-xl font-black text-slate-900 mt-1">
                {formatCurrency(profitReport.totalRevenue)}
              </div>
            </div>
            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
              <span className="text-xs text-slate-500 font-medium uppercase">Giá vốn xuất kho (FIFO)</span>
              <div className="text-xl font-bold text-slate-700 mt-1">
                {formatCurrency(profitReport.totalCost)}
              </div>
            </div>
            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
              <span className="text-xs text-slate-500 font-medium uppercase">Lợi nhuận gộp</span>
              <div className="text-xl font-black text-emerald-600 mt-1">
                {formatCurrency(profitReport.totalProfit)}
              </div>
            </div>
            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
              <span className="text-xs text-slate-500 font-medium uppercase">Tỷ suất lợi nhuận TB</span>
              <div className="text-xl font-black text-indigo-600 mt-1">
                {profitReport.avgMargin.toFixed(2)}%
              </div>
            </div>
          </div>

          {/* Sub Filters for Profit */}
          <div className="flex flex-wrap items-center gap-3 bg-white p-3.5 rounded-xl border border-slate-200 shadow-xs">
            <span className="text-xs font-bold text-slate-600 uppercase flex items-center gap-1">
              <Filter className="w-3.5 h-3.5" /> Lọc báo cáo:
            </span>

            {/* Filter by order */}
            <select
              value={profitOrderFilter}
              onChange={(e) => setProfitOrderFilter(e.target.value)}
              className="px-3 py-1.5 border border-slate-300 rounded-lg text-xs bg-white cursor-pointer"
            >
              <option value="all">Tất cả đơn hàng</option>
              {Array.from(new Set(data.orders.map((o) => o.orderCode))).map((code) => (
                <option key={code} value={code}>
                  Đơn {code}
                </option>
              ))}
            </select>

            {/* Filter by product */}
            <select
              value={profitProductFilter}
              onChange={(e) => setProfitProductFilter(e.target.value)}
              className="px-3 py-1.5 border border-slate-300 rounded-lg text-xs bg-white cursor-pointer"
            >
              <option value="all">Tất cả mặt hàng</option>
              {data.products.map((p) => (
                <option key={p.code} value={p.code}>
                  {p.code} - {p.name}
                </option>
              ))}
            </select>

            {/* Filter by Salesperson / Creator */}
            <select
              value={profitSalespersonFilter}
              onChange={(e) => setProfitSalespersonFilter(e.target.value)}
              className="px-3 py-1.5 border border-slate-300 rounded-lg text-xs bg-white cursor-pointer font-medium"
            >
              <option value="all">Tất cả người tạo đơn/bán hàng</option>
              {salespeople.map((sp) => (
                <option key={sp} value={sp}>
                  {sp}
                </option>
              ))}
            </select>

            <div className="ml-auto text-xs text-slate-500">
              Tổng số dòng: <strong className="text-slate-800">{profitReport.items.length}</strong>
            </div>
          </div>

          {/* Profit Table */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-xs text-left border-collapse min-w-[1200px]">
                <thead className="bg-slate-100 text-slate-700 uppercase font-bold text-[11px]">
                  <tr>
                    <th className="p-2.5 w-10 text-left">STT</th>
                    <th className="p-2.5 text-left">Mã đơn</th>
                    <th className="p-2.5 text-left">Ngày</th>
                    <th className="p-2.5 min-w-36 text-left">Khách hàng</th>
                    <th className="p-2.5 min-w-36 text-left">Người tạo đơn/Bán hàng</th>
                    <th className="p-2.5 text-left">Mã HH</th>
                    <th className="p-2.5 min-w-40 text-left">Tên Hàng Hóa</th>
                    <th className="p-2.5 text-left">ĐVT_Bán</th>
                    <th className="p-2.5 text-left">SL bán</th>
                    {/* NEW COLUMNS REQUESTED */}
                    <th className="p-2.5 text-left bg-indigo-50/70 text-indigo-900">SL quy đổi</th>
                    <th className="p-2.5 text-left bg-indigo-50/70 text-indigo-900">ĐVT_Mua</th>
                    <th className="p-2.5 text-left bg-indigo-50/70 text-indigo-950 font-bold">SL xuất (ĐVT_Mua)</th>
                    <th className="p-2.5 text-left">Đơn giá bán</th>
                    <th className="p-2.5 text-left font-bold">Doanh thu thuần</th>
                    <th className="p-2.5 text-left bg-amber-50 text-amber-950 font-black">
                      Giá vốn hàng bán (FIFO theo ĐVT_Mua)
                    </th>
                    <th className="p-2.5 text-left bg-emerald-50 text-emerald-900 font-black">Lợi nhuận gộp</th>
                    <th className="p-2.5 text-left bg-emerald-50 text-emerald-900 font-black">Tỷ suất LN (%)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {profitReport.items.length === 0 ? (
                    <tr>
                      <td colSpan={17} className="p-12 text-center text-slate-400">
                        Không có dữ liệu bán hàng trong khoảng thời gian đã chọn.
                      </td>
                    </tr>
                  ) : (
                    profitReport.items.map((item, idx) => {
                      const isFirstOfOrder = idx === 0 || item.orderCode !== profitReport.items[idx - 1]?.orderCode;
                      return (
                        <tr
                          key={item.id}
                          className={`hover:bg-slate-50/70 ${
                            isFirstOfOrder && idx > 0 ? 'border-t-2 border-slate-300' : ''
                          }`}
                        >
                          <td className="p-2.5 text-center text-slate-400">{idx + 1}</td>
                          <td className="p-2.5 font-mono font-bold text-blue-700">
                            {isFirstOfOrder ? item.orderCode : ''}
                          </td>
                          <td className="p-2.5 text-slate-600">
                            {isFirstOfOrder ? formatDate(item.orderDate) : ''}
                          </td>
                          <td className="p-2.5 text-slate-800 font-medium">
                            {isFirstOfOrder ? item.customerName : ''}
                          </td>
                          <td className="p-2.5 text-slate-800">
                            {isFirstOfOrder ? (item.createdByName || '—') : ''}
                          </td>
                        <td className="p-2.5 font-mono font-semibold text-slate-700">{item.productCode}</td>
                        <td className="p-2.5 font-medium text-slate-900">{item.productName}</td>
                        <td className="p-2.5 text-center text-slate-600">{item.saleUnit}</td>
                        <td className="p-2.5 text-right font-bold text-slate-900">{formatNumber(item.quantity)}</td>
                        {/* NEW: SL quy đổi, ĐVT_Mua, SL xuất theo ĐVT_Mua */}
                        <td className="p-2.5 text-center bg-indigo-50/20 font-mono text-indigo-700 font-medium">
                          {formatNumber(item.conversionRate)}
                        </td>
                        <td className="p-2.5 text-center bg-indigo-50/20 font-medium text-indigo-900">
                          {item.purchaseUnit}
                        </td>
                        <td className="p-2.5 text-right bg-indigo-50/30 font-bold text-indigo-950">
                          {formatNumber(item.quantityInPurchaseUnit, 2)}
                        </td>
                        <td className="p-2.5 text-right text-slate-700">{formatCurrency(item.salePrice)}</td>
                        <td className="p-2.5 text-right font-bold text-slate-900">{formatCurrency(item.revenue)}</td>
                        {/* Giá vốn hàng bán (Theo phương pháp FIFO tính theo ĐVT_Mua) */}
                        <td className="p-2.5 text-right bg-amber-50/50 font-bold text-amber-900">
                          {formatCurrency(item.totalCostFifo)}
                        </td>
                        <td className="p-2.5 text-right bg-emerald-50/50 font-black text-emerald-700">
                          {formatCurrency(item.grossProfit)}
                        </td>
                        <td className="p-2.5 text-right bg-emerald-50/50 font-black text-emerald-800">
                          {item.marginPercent.toFixed(1)}%
                        </td>
                      </tr>
                    );
                  })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* 3. BÁO CÁO CHI TIẾT GIÁ VỐN THEO TỪNG ĐƠN HÀNG, MẶT HÀNG, ĐƠN GIÁ XUẤT KHO (THEO FIFO) */}
      {activeReport === 'costDetails' && (
        <div className="space-y-4">
          {/* Helper Banner */}
          <div className="p-3.5 bg-amber-50/80 rounded-xl border border-amber-200 text-xs text-amber-950 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div>
              <span className="font-bold">Phương pháp FIFO (Nhập trước - Xuất trước):</span> Báo cáo bóc tách chi tiết từng dòng hàng xuất từ đơn hàng tương ứng với lô nhập kho nguồn (Bill No) nào, số lượng xuất và đơn giá xuất kho tương ứng theo từng ĐVT bán và ĐVT mua.
            </div>
            <span className="font-bold text-amber-900 whitespace-nowrap">
              Tổng số dòng chi tiết: {costDetailsReport.rows.length}
            </span>
          </div>

          {/* Sub Filters for Cost Details */}
          <div className="flex flex-wrap items-center gap-3 bg-white p-3.5 rounded-xl border border-slate-200 shadow-xs">
            <div className="relative flex-1 min-w-[200px] max-w-sm">
              <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder="Tìm mã đơn, tên hàng, số bill..."
                value={costSearchQuery}
                onChange={(e) => setCostSearchQuery(e.target.value)}
                className="w-full pl-8 pr-3 py-1.5 border border-slate-300 rounded-lg text-xs bg-white"
              />
            </div>

            {/* Filter by order */}
            <select
              value={costOrderFilter}
              onChange={(e) => setCostOrderFilter(e.target.value)}
              className="px-3 py-1.5 border border-slate-300 rounded-lg text-xs bg-white cursor-pointer"
            >
              <option value="all">Tất cả đơn hàng</option>
              {Array.from(new Set(data.orders.map((o) => o.orderCode))).map((code) => (
                <option key={code} value={code}>
                  Đơn {code}
                </option>
              ))}
            </select>

            {/* Filter by product */}
            <select
              value={costProductFilter}
              onChange={(e) => setCostProductFilter(e.target.value)}
              className="px-3 py-1.5 border border-slate-300 rounded-lg text-xs bg-white cursor-pointer"
            >
              <option value="all">Tất cả mặt hàng</option>
              {data.products.map((p) => (
                <option key={p.code} value={p.code}>
                  {p.code} - {p.name}
                </option>
              ))}
            </select>

            {/* Filter by Salesperson / Creator */}
            <select
              value={costSalespersonFilter}
              onChange={(e) => setCostSalespersonFilter(e.target.value)}
              className="px-3 py-1.5 border border-slate-300 rounded-lg text-xs bg-white cursor-pointer font-medium"
            >
              <option value="all">Tất cả người tạo đơn/bán hàng</option>
              {salespeople.map((sp) => (
                <option key={sp} value={sp}>
                  {sp}
                </option>
              ))}
            </select>
          </div>

          {/* Cost Details Table */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
            <div className="overflow-x-auto max-h-[72vh] overflow-y-auto">
              <table className="w-full text-xs text-left border-collapse min-w-[1250px]">
                <thead className="sticky top-0 z-20 bg-slate-100 text-slate-700 uppercase font-bold text-[11px] tracking-wider shadow-xs">
                  <tr>
                    <th className="p-2.5 w-10 text-left">STT</th>
                    <th className="p-2.5 text-left">Mã đơn</th>
                    <th className="p-2.5 text-left">Ngày đơn</th>
                    <th className="p-2.5 min-w-36 text-left">Khách hàng</th>
                    <th className="p-2.5 min-w-36 text-left">Người tạo đơn/Bán hàng</th>
                    <th className="p-2.5 text-left">Mã HH</th>
                    <th className="p-2.5 min-w-40 text-left">Tên Hàng Hóa</th>
                    <th className="p-2.5 text-left">ĐVT_Bán</th>
                    <th className="p-2.5 text-left font-bold">SL xuất (ĐVT_Bán)</th>
                    <th className="p-2.5 text-left bg-indigo-50/60 text-indigo-900">SL quy đổi</th>
                    <th className="p-2.5 text-left bg-indigo-50/60 text-indigo-900">ĐVT_Mua</th>
                    <th className="p-2.5 text-left bg-indigo-50/60 text-indigo-950 font-bold">
                      SL xuất (ĐVT_Mua)
                    </th>
                    <th className="p-2.5 bg-blue-50/70 text-blue-900 font-bold text-left">Lô nhập nguồn (Bill No)</th>
                    <th className="p-2.5 bg-blue-50/70 text-blue-900 text-left">Ngày nhập nguồn</th>
                    <th className="p-2.5 text-left bg-amber-50 text-amber-950 font-bold">
                      Đơn giá xuất kho (ĐVT_Bán)
                    </th>
                    <th className="p-2.5 text-left bg-amber-50 text-amber-950 font-bold">
                      Đơn giá xuất kho (ĐVT_Mua)
                    </th>
                    <th className="p-2.5 text-left bg-amber-100/70 text-amber-950 font-black">
                      Thành tiền Giá vốn (FIFO)
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {costDetailsReport.rows.length === 0 ? (
                    <tr>
                      <td colSpan={17} className="p-12 text-center text-slate-400">
                        Không có dữ liệu chi tiết giá vốn trong khoảng thời gian đã chọn.
                      </td>
                    </tr>
                  ) : (
                    costDetailsReport.rows.map((row, idx) => {
                      const isFirstOfOrder = idx === 0 || row.orderCode !== costDetailsReport.rows[idx - 1]?.orderCode;
                      return (
                        <tr
                          key={row.id}
                          className={`hover:bg-slate-50/80 ${
                            isFirstOfOrder && idx > 0 ? 'border-t-2 border-slate-300' : ''
                          }`}
                        >
                          <td className="p-2.5 text-center text-slate-400">{idx + 1}</td>
                          <td className="p-2.5 font-mono font-bold text-blue-700">
                            {isFirstOfOrder ? row.orderCode : ''}
                          </td>
                          <td className="p-2.5 text-slate-600">
                            {isFirstOfOrder ? formatDate(row.orderDate) : ''}
                          </td>
                          <td className="p-2.5 text-slate-800 font-medium">
                            {isFirstOfOrder ? row.customerName : ''}
                          </td>
                          <td className="p-2.5 text-slate-800">
                            {isFirstOfOrder ? (row.createdByName || '—') : ''}
                          </td>
                          <td className="p-2.5 font-mono font-semibold text-slate-700">{row.productCode}</td>
                          <td className="p-2.5 font-medium text-slate-900">{row.productName}</td>
                          <td className="p-2.5 text-center text-slate-600">{row.saleUnit}</td>
                          <td className="p-2.5 text-right font-bold text-slate-900">{formatNumber(row.lotExportQty)}</td>
                          <td className="p-2.5 text-center bg-indigo-50/20 font-mono text-indigo-700">
                            {formatNumber(row.conversionRate)}
                          </td>
                          <td className="p-2.5 text-center bg-indigo-50/20 text-indigo-900 font-medium">
                            {row.purchaseUnit}
                          </td>
                          <td className="p-2.5 text-right bg-indigo-50/30 font-bold text-indigo-950">
                            {formatNumber(row.lotExportQtyPurchaseUnit, 2)}
                          </td>
                          <td className="p-2.5 bg-blue-50/30 font-mono font-bold text-blue-800">
                            {row.lotBillNo}
                          </td>
                          <td className="p-2.5 bg-blue-50/30 text-slate-600">
                            {row.lotPurchaseDate !== '—' ? formatDate(row.lotPurchaseDate) : '—'}
                          </td>
                          <td className="p-2.5 text-right bg-amber-50/30 font-medium text-amber-900">
                            {formatCurrency(row.lotUnitCost)}
                          </td>
                          <td className="p-2.5 text-right bg-amber-50/30 font-medium text-amber-900">
                            {formatCurrency(row.lotUnitCostPurchaseUnit)}
                          </td>
                          <td className="p-2.5 text-right bg-amber-100/40 font-black text-amber-950">
                            {formatCurrency(row.lotTotalCost)}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* 4. BÁO CÁO SỐ LƯỢNG HÀNG BÁN CHO TỪNG KHÁCH HÀNG */}
      {activeReport === 'customerSales' && (
        <CustomerSalesReport
          data={data}
          startDate={startDate}
          endDate={endDate}
        />
      )}

      {/* Order Edit Modal triggered from Xuat Nhap Kho report */}
      {isOrderModalOpen && editingOrder && currentUser && settings && (
        <OrderFormModal
          isOpen={isOrderModalOpen}
          onClose={() => {
            setIsOrderModalOpen(false);
            setEditingOrder(null);
          }}
          onSave={(updated) => {
            onSaveOrder?.(updated);
            setIsOrderModalOpen(false);
            setEditingOrder(null);
          }}
          initialOrder={editingOrder}
          customers={data.customers}
          products={data.products}
          purchases={data.purchases}
          allOrders={data.orders}
          debtPayments={data.debtPayments}
          currentUser={currentUser}
          settings={settings}
          onAddNewCustomer={() => {}}
        />
      )}
    </div>
  );
};

